import {
  DifficultyLevel,
  type EvaluateResponseRequest,
  type GenerateQuestionRequest,
  type ParsedResumeProfile,
} from '@/types/interview';

const EVALUATION_JSON_SCHEMA = `{
  "accuracy": <number 0-100>,
  "clarity": <number 0-100>,
  "depth": <number 0-100>,
  "relevance": <number 0-100>,
  "feedback": "<string>"
}`;

const QUESTION_JSON_SCHEMA = `{
  "prompt": "<string>",
  "category": "technical" | "behavioral" | "system-design" | "problem-solving" | "role-fit",
  "expectedFocusAreas": ["<string>"]
}`;

export function buildResumeParsePrompt(rawText: string, targetRole: string): {
  system: string;
  user: string;
} {
  return {
    system: `You extract structured candidate profiles from resumes.
Respond with valid JSON only:
{
  "candidateName": "<string>",
  "skills": ["<string>"],
  "experienceYears": <number>,
  "highlights": ["<string>"],
  "rawExcerpt": "<string max 500 chars>"
}`,
    user: `Target role: ${targetRole}\n\nResume:\n${rawText.slice(0, 12_000)}`,
  };
}

export function buildQuestionGenerationPrompt(
  request: GenerateQuestionRequest
): { system: string; user: string } {
  const { role, jobDescription, resumeProfile, difficulty, questionIndex, priorTopics } =
    request;

  return {
    system: `You are a senior technical interviewer.
Generate one interview question as JSON only (no markdown):
${QUESTION_JSON_SCHEMA}
Difficulty tier: ${difficulty}.
Avoid repeating prior topics.`,
    user: [
      `Role: ${role}`,
      `Difficulty: ${difficulty}`,
      `Question number: ${questionIndex + 1}`,
      `Job description:\n${jobDescription.slice(0, 4_000)}`,
      `Candidate skills: ${resumeProfile.skills.join(', ')}`,
      `Experience: ${resumeProfile.experienceYears} years`,
      `Highlights: ${resumeProfile.highlights.join('; ')}`,
      priorTopics.length > 0 ? `Prior topics: ${priorTopics.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function buildResponseEvaluationPrompt(
  request: EvaluateResponseRequest
): { system: string; user: string } {
  const { question, answerText, submissionStatus } = request;

  return {
    system: `You evaluate mock interview answers.
Score content quality only; do NOT score time — time is calculated separately.
Respond with valid JSON only:
${EVALUATION_JSON_SCHEMA}
Be rigorous, specific, and constructive in feedback.`,
    user: [
      `Question (${question.category}, ${question.difficulty}): ${question.prompt}`,
      `Focus areas: ${question.expectedFocusAreas.join(', ')}`,
      `Submission status: ${submissionStatus}`,
      `Answer:\n${answerText.trim() || '(no answer provided)'}`,
    ].join('\n\n'),
  };
}

export function buildQuestionBankSeedContext(
  role: string,
  jobDescription: string,
  profile: ParsedResumeProfile,
  totalQuestions: number,
  difficulty: DifficultyLevel
): string {
  return `Role=${role}; Questions=${totalQuestions}; Tier=${difficulty}; Skills=${profile.skills.slice(0, 8).join(',')}; JD excerpt=${jobDescription.slice(0, 200)}`;
}
