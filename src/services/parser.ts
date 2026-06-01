import { aiService } from '@/services/aiService';
import type {
  AiResult,
  ParseResumeRequest,
  ParseResumeResult,
  ParsedResumeProfile,
} from '@/types/interview';

const SKILL_KEYWORDS = [
  'typescript',
  'javascript',
  'react',
  'node',
  'python',
  'java',
  'aws',
  'docker',
  'kubernetes',
  'sql',
  'graphql',
  'system design',
  'leadership',
  'communication',
] as const;

const EXPERIENCE_PATTERN =
  /(\d{1,2})\+?\s*(?:years|yrs)(?:\s+of)?\s+(?:experience|exp)/i;

/**
 * Heuristic, offline-safe resume parser.
 * Used as fallback when AI is unavailable or returns invalid payloads.
 */
export function parseResumeHeuristic(
  request: ParseResumeRequest
): ParsedResumeProfile {
  const { rawText, targetRole } = request;
  const normalized = rawText.replace(/\r\n/g, '\n').trim();

  const candidateName = extractCandidateName(normalized);
  const skills = extractSkills(normalized);
  const experienceYears = extractExperienceYears(normalized);
  const highlights = extractHighlights(normalized);

  return {
    candidateName,
    skills: skills.length > 0 ? skills : [targetRole, 'Problem Solving'],
    experienceYears,
    highlights,
    rawExcerpt: normalized.slice(0, 500),
  };
}

/**
 * Primary resume parse entry point.
 * Attempts AI extraction first; falls back to heuristic parsing on failure.
 */
export async function parseResume(
  request: ParseResumeRequest,
  options: { preferAi?: boolean } = {}
): Promise<ParseResumeResult> {
  const preferAi = options.preferAi ?? true;

  if (preferAi) {
    const aiResult = await aiService.parseResumeWithAi(
      request.rawText,
      request.targetRole
    );

    if (aiResult.success) {
      return aiResult;
    }

    if (!aiResult.error.retryable) {
      return {
        success: true,
        data: parseResumeHeuristic(request),
      };
    }

    return aiResult;
  }

  return {
    success: true,
    data: parseResumeHeuristic(request),
  };
}

export function extractResumePlainText(fileContent: string): string {
  return fileContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCandidateName(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const firstMeaningful = lines.find((line) => line.length > 2 && line.length < 60);
  if (!firstMeaningful) {
    return 'Candidate';
  }

  const nameLike = firstMeaningful.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
  return nameLike?.[1] ?? 'Candidate';
}

function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found = SKILL_KEYWORDS.filter((skill) => lower.includes(skill));
  return [...new Set(found.map(capitalizeSkill))];
}

function extractExperienceYears(text: string): number {
  const match = text.match(EXPERIENCE_PATTERN);
  if (!match?.[1]) {
    return 0;
  }
  return Math.min(40, Number.parseInt(match[1], 10));
}

function extractHighlights(text: string): string[] {
  const bulletLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-•*]/.test(line))
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter((line) => line.length > 20);

  if (bulletLines.length > 0) {
    return bulletLines.slice(0, 4);
  }

  const sentences = text
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);

  return sentences.slice(0, 3);
}

function capitalizeSkill(skill: string): string {
  return skill
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function mergeParseResults(
  primary: ParsedResumeProfile,
  fallback: ParsedResumeProfile
): ParsedResumeProfile {
  return {
    candidateName: primary.candidateName || fallback.candidateName,
    skills: primary.skills.length > 0 ? primary.skills : fallback.skills,
    experienceYears: primary.experienceYears || fallback.experienceYears,
    highlights: primary.highlights.length > 0 ? primary.highlights : fallback.highlights,
    rawExcerpt: primary.rawExcerpt || fallback.rawExcerpt,
  };
}

export type { AiResult, ParseResumeRequest, ParseResumeResult };
