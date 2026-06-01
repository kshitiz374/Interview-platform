import type { AiServiceError } from '@/types/interview';
import {
  DifficultyLevel,
  type InterviewQuestion,
  type ParsedResumeProfile,
  type QuestionCategory,
  type ResponseEvaluation,
} from '@/types/interview';
import { clampMetric } from '@/utils/scoringAlgorithms';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMetric(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return clampMetric(value);
}

function parseString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  return items.length > 0 ? items : null;
}

const QUESTION_CATEGORIES: readonly QuestionCategory[] = [
  'technical',
  'behavioral',
  'system-design',
  'problem-solving',
  'role-fit',
];

function parseCategory(value: unknown): QuestionCategory | null {
  if (typeof value !== 'string') {
    return null;
  }
  return QUESTION_CATEGORIES.includes(value as QuestionCategory)
    ? (value as QuestionCategory)
    : null;
}

/**
 * Safely normalizes an unknown AI payload into a ResponseEvaluation.
 * Returns null when the payload is malformed or incomplete.
 */
export function parseEvaluationPayload(raw: unknown): ResponseEvaluation | null {
  if (!isRecord(raw)) {
    return null;
  }

  const accuracy = parseMetric(raw.accuracy);
  const clarity = parseMetric(raw.clarity);
  const depth = parseMetric(raw.depth);
  const relevance = parseMetric(raw.relevance);
  const feedback = parseString(raw.feedback);

  if (
    accuracy === null ||
    clarity === null ||
    depth === null ||
    relevance === null ||
    feedback === null
  ) {
    return null;
  }

  const timeEfficiency =
    parseMetric(raw.timeEfficiency) ?? parseMetric(raw.time_efficiency) ?? 0;

  return {
    accuracy,
    clarity,
    depth,
    relevance,
    timeEfficiency,
    feedback,
  };
}

export function parseQuestionPayload(
  raw: unknown,
  defaults: {
    id: string;
    index: number;
    difficulty: DifficultyLevel;
    timeLimitMs: number;
  }
): InterviewQuestion | null {
  if (!isRecord(raw)) {
    return null;
  }

  const prompt = parseString(raw.prompt);
  const category = parseCategory(raw.category);
  const expectedFocusAreas = parseStringArray(raw.expectedFocusAreas);

  if (!prompt || !category || !expectedFocusAreas) {
    return null;
  }

  return {
    id: defaults.id,
    index: defaults.index,
    prompt,
    category,
    difficulty: defaults.difficulty,
    expectedFocusAreas,
    timeLimitMs: defaults.timeLimitMs,
  };
}

export function parseResumeProfilePayload(raw: unknown): ParsedResumeProfile | null {
  if (!isRecord(raw)) {
    return null;
  }

  const candidateName = parseString(raw.candidateName) ?? 'Candidate';
  const skills = parseStringArray(raw.skills) ?? [];
  const highlights = parseStringArray(raw.highlights) ?? [];
  const rawExcerpt = parseString(raw.rawExcerpt) ?? '';

  const experienceYears =
    typeof raw.experienceYears === 'number' && !Number.isNaN(raw.experienceYears)
      ? Math.max(0, Math.round(raw.experienceYears))
      : 0;

  return {
    candidateName,
    skills,
    experienceYears,
    highlights,
    rawExcerpt: rawExcerpt.slice(0, 500),
  };
}

export function extractJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return tryParseJson(fenced[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return tryParseJson(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return tryParseJson(trimmed);
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function mapHttpStatusToAiError(
  status: number,
  message: string
): AiServiceError {
  if (status === 429) {
    return { code: 'RATE_LIMIT', message, retryable: true };
  }
  if (status >= 500) {
    return { code: 'NETWORK', message, retryable: true };
  }
  if (status >= 400) {
    return { code: 'INVALID_PAYLOAD', message, retryable: false };
  }
  return { code: 'UNKNOWN', message, retryable: false };
}

export function mapUnknownToAiError(error: unknown): AiServiceError {
  if (error instanceof Error) {
    const isNetwork =
      error.message.includes('fetch') || error.message.includes('network');
    return {
      code: isNetwork ? 'NETWORK' : 'UNKNOWN',
      message: error.message,
      retryable: isNetwork,
    };
  }
  return {
    code: 'UNKNOWN',
    message: 'An unexpected error occurred.',
    retryable: false,
  };
}
