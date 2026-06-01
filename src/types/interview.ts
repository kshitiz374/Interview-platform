/**
 * Domain types for the AI-powered mock interview platform.
 * All interview lifecycle, scoring, and evaluation contracts live here.
 */

// ---------------------------------------------------------------------------
// Difficulty & readiness
// ---------------------------------------------------------------------------

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export type ReadinessStatus = 'Strong' | 'Average' | 'Needs Improvement';

// ---------------------------------------------------------------------------
// FSM: states & events
// ---------------------------------------------------------------------------

export enum InterviewLifecycleState {
  IDLE = 'IDLE',
  PARSING_INPUTS = 'PARSING_INPUTS',
  READY = 'READY',
  QUESTION_ACTIVE = 'QUESTION_ACTIVE',
  EVALUATING_RESPONSE = 'EVALUATING_RESPONSE',
  COMPLETED = 'COMPLETED',
  TERMINATED_EARLY = 'TERMINATED_EARLY',
}

/** Events that drive valid FSM transitions. */
export enum InterviewEventType {
  START_PARSING = 'START_PARSING',
  PARSING_COMPLETE = 'PARSING_COMPLETE',
  PARSING_FAILED = 'PARSING_FAILED',
  BEGIN_INTERVIEW = 'BEGIN_INTERVIEW',
  ACTIVATE_QUESTION = 'ACTIVATE_QUESTION',
  SUBMIT_RESPONSE = 'SUBMIT_RESPONSE',
  TIMER_EXPIRED = 'TIMER_EXPIRED',
  EVALUATION_COMPLETE = 'EVALUATION_COMPLETE',
  EVALUATION_FAILED = 'EVALUATION_FAILED',
  ADVANCE_QUESTION = 'ADVANCE_QUESTION',
  TERMINATE_EARLY = 'TERMINATE_EARLY',
  COMPLETE_INTERVIEW = 'COMPLETE_INTERVIEW',
  RESET = 'RESET',
}

export interface InterviewEventBase {
  type: InterviewEventType;
  timestamp: number;
}

export interface StartParsingEvent extends InterviewEventBase {
  type: InterviewEventType.START_PARSING;
  payload: {
    resumeText: string;
    jobDescription: string;
    targetRole: string;
  };
}

export interface ParsingCompleteEvent extends InterviewEventBase {
  type: InterviewEventType.PARSING_COMPLETE;
  payload: {
    parsedResume: ParsedResumeProfile;
    questionBank: InterviewQuestion[];
  };
}

export interface ParsingFailedEvent extends InterviewEventBase {
  type: InterviewEventType.PARSING_FAILED;
  payload: {
    error: string;
    recoverable: boolean;
  };
}

export interface BeginInterviewEvent extends InterviewEventBase {
  type: InterviewEventType.BEGIN_INTERVIEW;
}

export interface ActivateQuestionEvent extends InterviewEventBase {
  type: InterviewEventType.ACTIVATE_QUESTION;
  payload: {
    questionIndex: number;
  };
}

export interface SubmitResponseEvent extends InterviewEventBase {
  type: InterviewEventType.SUBMIT_RESPONSE;
  payload: {
    answerText: string;
    submittedAtMs: number;
    /** Wall-clock time spent on this question (ms). */
    elapsedMs: number;
  };
}

export interface TimerExpiredEvent extends InterviewEventBase {
  type: InterviewEventType.TIMER_EXPIRED;
  payload: {
    questionIndex: number;
    elapsedMs: number;
  };
}

export interface EvaluationCompleteEvent extends InterviewEventBase {
  type: InterviewEventType.EVALUATION_COMPLETE;
  payload: {
    evaluation: ResponseEvaluation;
    /** When omitted, the reducer builds the record from `pendingSubmission`. */
    record?: QuestionResponseRecord;
  };
}

export interface EvaluationFailedEvent extends InterviewEventBase {
  type: InterviewEventType.EVALUATION_FAILED;
  payload: {
    error: string;
    questionIndex: number;
  };
}

export interface AdvanceQuestionEvent extends InterviewEventBase {
  type: InterviewEventType.ADVANCE_QUESTION;
}

export interface TerminateEarlyEvent extends InterviewEventBase {
  type: InterviewEventType.TERMINATE_EARLY;
  payload: {
    reason: EarlyTerminationReason;
    movingAverageScore: number;
  };
}

export interface CompleteInterviewEvent extends InterviewEventBase {
  type: InterviewEventType.COMPLETE_INTERVIEW;
  payload: {
    report: FinalReadinessReport;
  };
}

export interface ResetEvent extends InterviewEventBase {
  type: InterviewEventType.RESET;
}

export type InterviewEvent =
  | StartParsingEvent
  | ParsingCompleteEvent
  | ParsingFailedEvent
  | BeginInterviewEvent
  | ActivateQuestionEvent
  | SubmitResponseEvent
  | TimerExpiredEvent
  | EvaluationCompleteEvent
  | EvaluationFailedEvent
  | AdvanceQuestionEvent
  | TerminateEarlyEvent
  | CompleteInterviewEvent
  | ResetEvent;

// ---------------------------------------------------------------------------
// Input parsing & questions
// ---------------------------------------------------------------------------

export interface ParsedResumeProfile {
  candidateName: string;
  skills: string[];
  experienceYears: number;
  highlights: string[];
  rawExcerpt: string;
}

export interface InterviewSetupInput {
  resumeText: string;
  jobDescription: string;
  targetRole: string;
  totalQuestions: number;
  perQuestionTimeLimitMs: number;
}

export interface InterviewQuestion {
  id: string;
  index: number;
  prompt: string;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  expectedFocusAreas: string[];
  timeLimitMs: number;
}

export type QuestionCategory =
  | 'technical'
  | 'behavioral'
  | 'system-design'
  | 'problem-solving'
  | 'role-fit';

// ---------------------------------------------------------------------------
// Runtime context (FSM snapshot)
// ---------------------------------------------------------------------------

export interface InterviewContext {
  /** Current FSM state. */
  lifecycleState: InterviewLifecycleState;
  /** Zero-based index of the active or next question. */
  currentQuestionIndex: number;
  /** Adaptive difficulty for upcoming / current question. */
  difficultyTier: DifficultyLevel;
  /** Ordered history of per-question outcomes. */
  responseHistory: readonly QuestionResponseRecord[];
  /** Running composite scores (0–100) across answered questions. */
  accumulatedScores: readonly number[];
  /** Milliseconds remaining for the active question. */
  remainingTimeMs: number;
  /** Total configured questions for this session. */
  totalQuestions: number;
  /** Per-question time budget in milliseconds. */
  perQuestionTimeLimitMs: number;
  /** Parsed candidate profile after resume ingestion. */
  parsedResume: ParsedResumeProfile | null;
  /** Generated question set for the session. */
  questionBank: readonly InterviewQuestion[];
  /** Consecutive high scores (>= 80%) for tier promotion. */
  consecutiveHighScoreCount: number;
  /** Consecutive low scores (< 50%) for tier demotion. */
  consecutiveLowScoreCount: number;
  /** Cumulative moving average of composite scores (0–100). */
  movingAverageScore: number;
  /** Session-level error message when parsing or evaluation fails. */
  lastError: string | null;
  /** ISO timestamp when the interview session started. */
  sessionStartedAt: string | null;
  /** ISO timestamp when the interview reached a terminal state. */
  sessionEndedAt: string | null;
}

export const INITIAL_INTERVIEW_CONTEXT: InterviewContext = {
  lifecycleState: InterviewLifecycleState.IDLE,
  currentQuestionIndex: 0,
  difficultyTier: DifficultyLevel.MEDIUM,
  responseHistory: [],
  accumulatedScores: [],
  remainingTimeMs: 0,
  totalQuestions: 0,
  perQuestionTimeLimitMs: 0,
  parsedResume: null,
  questionBank: [],
  consecutiveHighScoreCount: 0,
  consecutiveLowScoreCount: 0,
  movingAverageScore: 0,
  lastError: null,
  sessionStartedAt: null,
  sessionEndedAt: null,
};

// ---------------------------------------------------------------------------
// Responses, evaluation & scoring thresholds
// ---------------------------------------------------------------------------

export type AnswerSubmissionStatus = 'complete' | 'incomplete' | 'timeout';

export interface QuestionResponseRecord {
  questionId: string;
  questionIndex: number;
  difficultyAtAsk: DifficultyLevel;
  answerText: string;
  submissionStatus: AnswerSubmissionStatus;
  submittedAtMs: number;
  elapsedMs: number;
  evaluation: ResponseEvaluation;
  compositeScore: number;
}

export interface ResponseEvaluation {
  accuracy: number;
  clarity: number;
  depth: number;
  relevance: number;
  timeEfficiency: number;
  feedback: string;
}

/** Weighted dimensions used to compute composite score (must sum to 1). */
export interface ScoringWeights {
  accuracy: number;
  clarity: number;
  depth: number;
  relevance: number;
  timeEfficiency: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  accuracy: 0.3,
  clarity: 0.2,
  depth: 0.2,
  relevance: 0.2,
  timeEfficiency: 0.1,
};

/** Domain constants for adaptation & early termination (pure config, no magic in UI). */
export const SCORING_THRESHOLDS = {
  HIGH_SCORE: 80,
  LOW_SCORE: 50,
  EARLY_TERMINATION_AVERAGE: 40,
  EARLY_TERMINATION_MIN_QUESTIONS: 3,
  CONSECUTIVE_HIGH_FOR_PROMOTION: 2,
  CONSECUTIVE_LOW_FOR_DEMOTION: 2,
  TIMEOUT_SCORE: 0,
  MIN_METRIC: 0,
  MAX_METRIC: 100,
} as const;

export type EarlyTerminationReason =
  | 'moving_average_below_threshold'
  | 'user_aborted'
  | 'unrecoverable_error';

export interface FinalReadinessReport {
  overallScore: number;
  readinessStatus: ReadinessStatus;
  breakdown: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  actionableInsights: string[];
  isHirable: boolean;
}

// ---------------------------------------------------------------------------
// Timer hook contracts
// ---------------------------------------------------------------------------

export enum TimerStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
}

export interface TimerState {
  status: TimerStatus;
  /** Remaining time in milliseconds. */
  remainingMs: number;
  /** Initial budget in milliseconds. */
  totalMs: number;
  /** Elapsed time since start in milliseconds. */
  elapsedMs: number;
}

export interface UseInterviewTimerOptions {
  durationMs: number;
  onExpire: () => void;
  autoStart?: boolean;
}

export interface UseInterviewTimerReturn {
  timerState: TimerState;
  start: () => void;
  pause: () => void;
  reset: (durationMs?: number) => void;
  isExpired: boolean;
}

// ---------------------------------------------------------------------------
// Engine hook contracts
// ---------------------------------------------------------------------------

export interface UseInterviewEngineOptions {
  setup: InterviewSetupInput;
  scoringWeights?: ScoringWeights;
}

export interface UseInterviewEngineReturn {
  context: InterviewContext;
  dispatch: (event: InterviewEvent) => void;
  currentQuestion: InterviewQuestion | null;
  canSubmit: boolean;
  isTerminal: boolean;
  finalReport: FinalReadinessReport | null;
}

// ---------------------------------------------------------------------------
// AI service contracts
// ---------------------------------------------------------------------------

export interface GenerateQuestionRequest {
  role: string;
  jobDescription: string;
  resumeProfile: ParsedResumeProfile;
  difficulty: DifficultyLevel;
  questionIndex: number;
  priorTopics: string[];
}

export interface EvaluateResponseRequest {
  question: InterviewQuestion;
  answerText: string;
  submissionStatus: AnswerSubmissionStatus;
  elapsedMs: number;
  timeLimitMs: number;
}

export interface AiServiceError {
  code: 'NETWORK' | 'RATE_LIMIT' | 'INVALID_PAYLOAD' | 'UNKNOWN';
  message: string;
  retryable: boolean;
}

export type AiResult<T> =
  | { success: true; data: T }
  | { success: false; error: AiServiceError };

// ---------------------------------------------------------------------------
// Parser service contracts
// ---------------------------------------------------------------------------

export interface ParseResumeRequest {
  rawText: string;
  targetRole: string;
}

export type ParseResumeResult = AiResult<ParsedResumeProfile>;

// ---------------------------------------------------------------------------
// Utility type guards & helpers
// ---------------------------------------------------------------------------

export const TERMINAL_LIFECYCLE_STATES: readonly InterviewLifecycleState[] = [
  InterviewLifecycleState.COMPLETED,
  InterviewLifecycleState.TERMINATED_EARLY,
] as const;

export function isTerminalState(state: InterviewLifecycleState): boolean {
  return (TERMINAL_LIFECYCLE_STATES as readonly string[]).includes(state);
}

export function isActiveQuestionState(state: InterviewLifecycleState): boolean {
  return state === InterviewLifecycleState.QUESTION_ACTIVE;
}

export function getNextDifficultyTier(
  current: DifficultyLevel,
  direction: 'up' | 'down'
): DifficultyLevel {
  const order: readonly DifficultyLevel[] = [
    DifficultyLevel.EASY,
    DifficultyLevel.MEDIUM,
    DifficultyLevel.HARD,
  ];
  const index = order.indexOf(current);
  if (direction === 'up' && index < order.length - 1) {
    return order[index + 1] as DifficultyLevel;
  }
  if (direction === 'down' && index > 0) {
    return order[index - 1] as DifficultyLevel;
  }
  return current;
}
