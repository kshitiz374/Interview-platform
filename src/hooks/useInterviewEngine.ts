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
  type EarlyTerminationReason,
  type FinalReadinessReport,
  type InterviewEvent,
  type InterviewQuestion,
  type ParsedResumeProfile,
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
  startParsing: (payload: {
    resumeText: string;
    jobDescription: string;
    targetRole: string;
  }) => void;
  completeParsing: (
    parsedResume: ParsedResumeProfile,
    questionBank: InterviewQuestion[]
  ) => void;
  failParsing: (error: string, recoverable?: boolean) => void;
  beginInterview: () => void;
  submitAnswer: (answerText: string, elapsedMs: number) => void;
  handleTimerExpiry: (elapsedMs: number) => void;
  applyEvaluation: (evaluation: ResponseEvaluation) => void;
  failEvaluation: (error: string) => void;
  activateQuestion: (questionIndex: number) => void;
  terminateEarly: (reason: EarlyTerminationReason) => void;
  completeInterview: (report: FinalReadinessReport) => void;
  reset: () => void;
  dispatch: (event: InterviewEvent) => void;
}

export type UseInterviewEngineResult = UseInterviewEngineReturn &
  UseInterviewEngineActions;

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
    (parsedResume: ParsedResumeProfile, questionBank: InterviewQuestion[]) => {
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
    (reason: EarlyTerminationReason) => {
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
    (report: FinalReadinessReport) => {
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
