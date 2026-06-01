import type { InterviewSetupInput } from '@/types/interview';

export const DEFAULT_INTERVIEW_SETUP: InterviewSetupInput = {
  resumeText: '',
  jobDescription: '',
  targetRole: 'Software Engineer',
  totalQuestions: 5,
  perQuestionTimeLimitMs: 90_000,
};
