import { resolveProviderFromEnv } from '@/services/ai/aiClient';
import {
  buildQuestionGenerationPrompt,
  buildResponseEvaluationPrompt,
  buildResumeParsePrompt,
} from '@/services/ai/promptBuilder';
import {
  extractJsonFromModelText,
  parseEvaluationPayload,
  parseQuestionPayload,
  parseResumeProfilePayload,
} from '@/services/ai/payloadParser';
import { getAiErrorFromProvider } from '@/services/ai/providerErrors';
import type { AiProvider } from '@/services/ai/providers/types';
import type {
  AiResult,
  DifficultyLevel,
  EvaluateResponseRequest,
  GenerateQuestionRequest,
  InterviewQuestion,
  ParsedResumeProfile,
  ResponseEvaluation,
} from '@/types/interview';
import {
  applyTimeEfficiencyToEvaluation,
  createTimeoutEvaluation,
} from '@/utils/scoringAlgorithms';

export interface AiService {
  generateQuestion(
    request: GenerateQuestionRequest
  ): Promise<AiResult<InterviewQuestion>>;
  evaluateResponse(
    request: EvaluateResponseRequest
  ): Promise<AiResult<ResponseEvaluation>>;
  parseResumeWithAi(
    rawText: string,
    targetRole: string
  ): Promise<AiResult<ParsedResumeProfile>>;
  generateQuestionBank(params: {
    role: string;
    jobDescription: string;
    resumeProfile: ParsedResumeProfile;
    totalQuestions: number;
    perQuestionTimeLimitMs: number;
    initialDifficulty: DifficultyLevel;
  }): Promise<AiResult<InterviewQuestion[]>>;
}

export interface CreateAiServiceOptions {
  provider?: AiProvider;
}

export function createAiService(options: CreateAiServiceOptions = {}): AiService {
  const provider = options.provider ?? resolveProviderFromEnv();
  return new InterviewAiService(provider);
}

/** Default singleton for app-wide use. */
export const aiService = createAiService();

class InterviewAiService implements AiService {
  constructor(private readonly provider: AiProvider) {}

  async generateQuestion(
    request: GenerateQuestionRequest
  ): Promise<AiResult<InterviewQuestion>> {
    return safeAiCall(async () => {
      const { system, user } = buildQuestionGenerationPrompt(request);
      const rawText = await this.provider.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.5,
      });

      const parsed = parseQuestionPayload(extractJsonFromModelText(rawText), {
        id: `q-${request.questionIndex + 1}`,
        index: request.questionIndex,
        difficulty: request.difficulty,
        timeLimitMs: 0,
      });

      if (!parsed) {
        throw invalidPayloadError('Question response failed schema validation.');
      }

      return parsed;
    });
  }

  async evaluateResponse(
    request: EvaluateResponseRequest
  ): Promise<AiResult<ResponseEvaluation>> {
    if (request.submissionStatus === 'timeout') {
      return { success: true, data: createTimeoutEvaluation() };
    }

    return safeAiCall(async () => {
      const { system, user } = buildResponseEvaluationPrompt(request);
      const rawText = await this.provider.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
      });

      const parsed = parseEvaluationPayload(extractJsonFromModelText(rawText));
      if (!parsed) {
        throw invalidPayloadError('Evaluation response failed schema validation.');
      }

      return applyTimeEfficiencyToEvaluation(parsed, {
        elapsedMs: request.elapsedMs,
        timeLimitMs: request.timeLimitMs,
        submissionStatus: request.submissionStatus,
      });
    });
  }

  async parseResumeWithAi(
    rawText: string,
    targetRole: string
  ): Promise<AiResult<ParsedResumeProfile>> {
    return safeAiCall(async () => {
      const { system, user } = buildResumeParsePrompt(rawText, targetRole);
      const rawResponse = await this.provider.complete({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
      });

      const parsed = parseResumeProfilePayload(
        extractJsonFromModelText(rawResponse)
      );

      if (!parsed) {
        throw invalidPayloadError('Resume parse response failed schema validation.');
      }

      return {
        ...parsed,
        rawExcerpt: parsed.rawExcerpt || rawText.slice(0, 500),
      };
    });
  }

  async generateQuestionBank(params: {
    role: string;
    jobDescription: string;
    resumeProfile: ParsedResumeProfile;
    totalQuestions: number;
    perQuestionTimeLimitMs: number;
    initialDifficulty: DifficultyLevel;
  }): Promise<AiResult<InterviewQuestion[]>> {
    const questions: InterviewQuestion[] = [];
    const priorTopics: string[] = [];
    let difficulty = params.initialDifficulty;

    for (let index = 0; index < params.totalQuestions; index += 1) {
      const result = await this.generateQuestion({
        role: params.role,
        jobDescription: params.jobDescription,
        resumeProfile: params.resumeProfile,
        difficulty,
        questionIndex: index,
        priorTopics,
      });

      if (!result.success) {
        return result;
      }

      const question: InterviewQuestion = {
        ...result.data,
        timeLimitMs: params.perQuestionTimeLimitMs,
      };

      questions.push(question);
      priorTopics.push(question.category);
    }

    return { success: true, data: questions };
  }
}

async function safeAiCall<T>(fn: () => Promise<T>): Promise<AiResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    const aiError = getAiErrorFromProvider(error);
    return { success: false, error: aiError };
  }
}

function invalidPayloadError(message: string): Error {
  const err = new Error(message);
  (err as Error & { aiError: import('@/types/interview').AiServiceError }).aiError = {
    code: 'INVALID_PAYLOAD',
    message,
    retryable: false,
  };
  return err;
}

export { createAiProvider, resolveProviderFromEnv } from '@/services/ai/aiClient';
