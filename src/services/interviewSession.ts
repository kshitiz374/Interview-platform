import { getAiService } from '@/services/aiService';
import { parseResume } from '@/services/parser';
import {
  DifficultyLevel,
  type AiResult,
  type InterviewQuestion,
  type InterviewSetupInput,
  type ParsedResumeProfile,
} from '@/types/interview';

export interface PreparedInterviewSession {
  parsedResume: ParsedResumeProfile;
  questionBank: InterviewQuestion[];
}

export async function prepareInterviewSession(
  setup: InterviewSetupInput
): Promise<AiResult<PreparedInterviewSession>> {
  const parseResult = await parseResume({
    rawText: setup.resumeText,
    targetRole: setup.targetRole,
  });

  if (!parseResult.success) {
    return parseResult;
  }

  const questionResult = await getAiService().generateQuestionBank({
    role: setup.targetRole,
    jobDescription: setup.jobDescription,
    resumeProfile: parseResult.data,
    totalQuestions: setup.totalQuestions,
    perQuestionTimeLimitMs: setup.perQuestionTimeLimitMs,
    initialDifficulty: DifficultyLevel.MEDIUM,
  });

  if (!questionResult.success) {
    return questionResult;
  }

  return {
    success: true,
    data: {
      parsedResume: parseResult.data,
      questionBank: questionResult.data,
    },
  };
}
