import { useCallback, useMemo, useReducer } from 'react';
import {
  createInitialEngineState,
  interviewReducer,
} from '@/hooks/interviewReducer';
import {
  DEFAULT_SCORING_WEIGHTS,
  InterviewEventType,
  InterviewLifecycleState,
  isTerminalState,
  type InterviewEvent,
  type ResponseEvaluation,
  type UseInterviewEngineOptions,
  type UseInterviewEngineReturn,
} from '@/types/interview';
import {
  buildResponseRecord,
  computeCompositeScore,
  createTimeoutEvaluation,
} from '@/utils/scoringAlgorithms';

export interface UseInterviewEngineActions {
  /**
   * IDLE → PARSING_INPUTS
   * Begins resume/JD ingestion. UI should call parsing service, then dispatch result.
   */
  startParsing: (payload: {
    resumeText: string;
    jobDescription: string;
    targetRole: string;
  }) => void;

  /** PARSING_INPUTS → READY */
  completeParsing: (
    parsedResume: import('@/types/interview').ParsedResumeProfile,
    questionBank: import('@/types/interview').InterviewQuestion[]
  ) => void;

  /** PARSING_INPUTS → IDLE */
  failParsing: (error: string, recoverable?: boolean) => void;

  /**
   * READY → QUESTION_ACTIVE
   * Starts session clock and activates question 0.
   */
  beginInterview: () => void;

  /**
   * QUESTION_ACTIVE → EVALUATING_RESPONSE
   * Caller must follow with `applyEvaluation` (AI) or use `handleTimerExpiry`.
   */
  submitAnswer: (answerText: string, elapsedMs: number) => void;

  /**
   * QUESTION_ACTIVE → EVALUATING_RESPONSE → (auto) EVALUATION_COMPLETE
   * Applies deterministic timeout scoring (0% on all metrics).
   */
  handleTimerExpiry: (elapsedMs: number) => void;

  /**
   * EVALUATING_RESPONSE → QUESTION_ACTIVE | READY | TERMINATED_EARLY
   * Merges AI evaluation into history and runs adaptation / early-exit checks.
   */
  applyEvaluation: (evaluation: ResponseEvaluation) => void;

  /** EVALUATING_RESPONSE → QUESTION_ACTIVE (recoverable failure) */
  failEvaluation: (error: string) => void;

  /** READY → QUESTION_ACTIVE (manual re-activation after last question) */
  activateQuestion: (questionIndex: number) => void;

  /** * → TERMINATED_EARLY */
  terminateEarly: (
    reason: import('@/types/interview').EarlyTerminationReason
  ) => void;

  /** * → COMPLETED */
  completeInterview: (
    report: import('@/types/interview').FinalReadinessReport
  ) => void;

  /** * → IDLE */
  reset: () => void;

  /** Low-level escape hatch for custom orchestration. */
  dispatch: (event: InterviewEvent) => void;
}

export type UseInterviewEngineResult = UseInterviewEngineReturn &
  UseInterviewEngineActions;

/**
 * Central interview FSM orchestrator.
 * All domain transitions flow through the reducer; UI only calls action helpers.
 */
export function useInterviewEngine(
  options: UseInterviewEngineOptions
): UseInterviewEngineResult {
  const { setup, scoringWeights = DEFAULT_SCORING_WEIGHTS } = options;

  const [state, dispatch] = useReducer(
    interviewReducer,
    { setup, scoringWeights },
    (init) => createInitialEngineState(init.setup, init.scoringWeights)
  );

  const { context, finalReport } = state;

  const currentQuestion = useMemo(() => {
    if (context.questionBank.length === 0) {
      return null;
    }
    return context.questionBank[context.currentQuestionIndex] ?? null;
  }, [context.questionBank, context.currentQuestionIndex]);

  const canSubmit =
    context.lifecycleState === InterviewLifecycleState.QUESTION_ACTIVE;

  const isTerminal = isTerminalState(context.lifecycleState);

  const dispatchWithTimestamp = useCallback((event: InterviewEvent) => {
    dispatch(event);
  }, []);

  const startParsing = useCallback(
    (payload: { resumeText: string; jobDescription: string; targetRole: string }) => {
      dispatchWithTimestamp({
        type: InterviewEventType.START_PARSING,
        timestamp: Date.now(),
        payload,
      });
    },
    [dispatchWithTimestamp]
  );

  const completeParsing = useCallback(
    (
      parsedResume: import('@/types/interview').ParsedResumeProfile,
      questionBank: import('@/types/interview').InterviewQuestion[]
    ) => {
      dispatchWithTimestamp({
        type: InterviewEventType.PARSING_COMPLETE,
        timestamp: Date.now(),
        payload: { parsedResume, questionBank },
      });
    },
    [dispatchWithTimestamp]
  );

  const failParsing = useCallback(
    (error: string, recoverable = true) => {
      dispatchWithTimestamp({
        type: InterviewEventType.PARSING_FAILED,
        timestamp: Date.now(),
        payload: { error, recoverable },
      });
    },
    [dispatchWithTimestamp]
  );

  const beginInterview = useCallback(() => {
    dispatchWithTimestamp({
      type: InterviewEventType.BEGIN_INTERVIEW,
      timestamp: Date.now(),
    });
  }, [dispatchWithTimestamp]);

  const submitAnswer = useCallback(
    (answerText: string, elapsedMs: number) => {
      dispatchWithTimestamp({
        type: InterviewEventType.SUBMIT_RESPONSE,
        timestamp: Date.now(),
        payload: {
          answerText,
          submittedAtMs: Date.now(),
          elapsedMs,
        },
      });
    },
    [dispatchWithTimestamp]
  );

  const applyEvaluation = useCallback(
    (evaluation: ResponseEvaluation) => {
      dispatchWithTimestamp({
        type: InterviewEventType.EVALUATION_COMPLETE,
        timestamp: Date.now(),
        payload: { evaluation },
      });
    },
    [dispatchWithTimestamp]
  );

  const handleTimerExpiry = useCallback(
    (elapsedMs: number) => {
      const questionIndex = state.context.currentQuestionIndex;

      dispatchWithTimestamp({
        type: InterviewEventType.TIMER_EXPIRED,
        timestamp: Date.now(),
        payload: { questionIndex, elapsedMs },
      });

      const question = state.context.questionBank[questionIndex];
      if (!question) {
        return;
      }

      const evaluation = createTimeoutEvaluation();
      const compositeScore = computeCompositeScore(
        evaluation,
        state.scoringWeights
      );

      const record = buildResponseRecord({
        questionId: question.id,
        questionIndex: question.index,
        difficultyAtAsk: state.context.difficultyTier,
        answerText: '',
        submissionStatus: 'timeout',
        submittedAtMs: Date.now(),
        elapsedMs,
        evaluation,
        compositeScore,
      });

      dispatchWithTimestamp({
        type: InterviewEventType.EVALUATION_COMPLETE,
        timestamp: Date.now(),
        payload: { evaluation, record },
      });
    },
    [dispatchWithTimestamp, state]
  );

  const failEvaluation = useCallback(
    (error: string) => {
      dispatchWithTimestamp({
        type: InterviewEventType.EVALUATION_FAILED,
        timestamp: Date.now(),
        payload: {
          error,
          questionIndex: state.context.currentQuestionIndex,
        },
      });
    },
    [dispatchWithTimestamp, state.context.currentQuestionIndex]
  );

  const activateQuestion = useCallback(
    (questionIndex: number) => {
      dispatchWithTimestamp({
        type: InterviewEventType.ACTIVATE_QUESTION,
        timestamp: Date.now(),
        payload: { questionIndex },
      });
    },
    [dispatchWithTimestamp]
  );

  const terminateEarly = useCallback(
    (reason: import('@/types/interview').EarlyTerminationReason) => {
      dispatchWithTimestamp({
        type: InterviewEventType.TERMINATE_EARLY,
        timestamp: Date.now(),
        payload: {
          reason,
          movingAverageScore: state.context.movingAverageScore,
        },
      });
    },
    [dispatchWithTimestamp, state.context.movingAverageScore]
  );

  const completeInterview = useCallback(
    (report: import('@/types/interview').FinalReadinessReport) => {
      dispatchWithTimestamp({
        type: InterviewEventType.COMPLETE_INTERVIEW,
        timestamp: Date.now(),
        payload: { report },
      });
    },
    [dispatchWithTimestamp]
  );

  const reset = useCallback(() => {
    dispatchWithTimestamp({
      type: InterviewEventType.RESET,
      timestamp: Date.now(),
    });
  }, [dispatchWithTimestamp]);

  return {
    context,
    dispatch: dispatchWithTimestamp,
    currentQuestion,
    canSubmit,
    isTerminal,
    finalReport,
    startParsing,
    completeParsing,
    failParsing,
    beginInterview,
    submitAnswer,
    handleTimerExpiry,
    applyEvaluation,
    failEvaluation,
    activateQuestion,
    terminateEarly,
    completeInterview,
    reset,
  };
}
