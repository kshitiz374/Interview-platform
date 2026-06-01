import {
  applyDifficultyAdaptation,
  computeCompositeScore,
  computeMovingAverage,
  shouldTerminateEarly,
} from '@/utils/scoringAlgorithms';
import {
  DEFAULT_SCORING_WEIGHTS,
  INITIAL_INTERVIEW_CONTEXT,
  InterviewEventType,
  InterviewLifecycleState,
  type InterviewContext,
  type QuestionResponseRecord,
  type ResponseEvaluation,
  type InterviewEvent,
  type InterviewSetupInput,
  type InterviewQuestion,
  type FinalReadinessReport,
  type ScoringWeights,
} from '@/types/interview';

export interface PendingSubmission {
  answerText: string;
  submittedAtMs: number;
  submissionStatus: 'complete' | 'incomplete' | 'timeout';
  elapsedMs: number;
}

export interface InterviewEngineState {
  context: InterviewContext;
  pendingSubmission: PendingSubmission | null;
  finalReport: FinalReadinessReport | null;
  scoringWeights: ScoringWeights;
}

export function createInitialEngineState(
  setup: InterviewSetupInput,
  scoringWeights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): InterviewEngineState {
  return {
    context: {
      ...INITIAL_INTERVIEW_CONTEXT,
      totalQuestions: setup.totalQuestions,
      perQuestionTimeLimitMs: setup.perQuestionTimeLimitMs,
    },
    pendingSubmission: null,
    finalReport: null,
    scoringWeights,
  };
}

export function interviewReducer(
  state: InterviewEngineState,
  event: InterviewEvent
): InterviewEngineState {
  const { context } = state;

  switch (event.type) {
    case InterviewEventType.START_PARSING: {
      if (context.lifecycleState !== InterviewLifecycleState.IDLE) {
        return state;
      }
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.PARSING_INPUTS,
          lastError: null,
        },
        pendingSubmission: null,
        finalReport: null,
      };
    }

    case InterviewEventType.PARSING_COMPLETE: {
      if (context.lifecycleState !== InterviewLifecycleState.PARSING_INPUTS) {
        return state;
      }
      const { parsedResume, questionBank } = event.payload;
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.READY,
          parsedResume,
          questionBank,
          totalQuestions: questionBank.length,
          lastError: null,
        },
      };
    }

    case InterviewEventType.PARSING_FAILED: {
      if (context.lifecycleState !== InterviewLifecycleState.PARSING_INPUTS) {
        return state;
      }
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.IDLE,
          lastError: event.payload.error,
        },
      };
    }

    case InterviewEventType.BEGIN_INTERVIEW: {
      if (context.lifecycleState !== InterviewLifecycleState.READY) {
        return state;
      }
      return activateQuestionState(state, 0, new Date().toISOString());
    }

    case InterviewEventType.ACTIVATE_QUESTION: {
      const allowedStates: InterviewLifecycleState[] = [
        InterviewLifecycleState.READY,
        InterviewLifecycleState.QUESTION_ACTIVE,
      ];
      if (!allowedStates.includes(context.lifecycleState)) {
        return state;
      }
      return activateQuestionState(
        state,
        event.payload.questionIndex,
        context.sessionStartedAt
      );
    }

    case InterviewEventType.SUBMIT_RESPONSE: {
      if (context.lifecycleState !== InterviewLifecycleState.QUESTION_ACTIVE) {
        return state;
      }
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.EVALUATING_RESPONSE,
        },
        pendingSubmission: {
          answerText: event.payload.answerText,
          submittedAtMs: event.payload.submittedAtMs,
          submissionStatus: 'complete',
          elapsedMs: event.payload.elapsedMs,
        },
      };
    }

    case InterviewEventType.TIMER_EXPIRED: {
      if (context.lifecycleState !== InterviewLifecycleState.QUESTION_ACTIVE) {
        return state;
      }
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.EVALUATING_RESPONSE,
          remainingTimeMs: 0,
        },
        pendingSubmission: {
          answerText: '',
          submittedAtMs: event.timestamp,
          submissionStatus: 'timeout',
          elapsedMs: event.payload.elapsedMs,
        },
      };
    }

    case InterviewEventType.EVALUATION_COMPLETE: {
      if (context.lifecycleState !== InterviewLifecycleState.EVALUATING_RESPONSE) {
        return state;
      }
      const record =
        event.payload.record ??
        buildRecordFromPending(state, event.payload.evaluation);
      if (!record) {
        return {
          ...state,
          context: {
            ...context,
            lifecycleState: InterviewLifecycleState.QUESTION_ACTIVE,
            lastError: 'Evaluation received without a pending submission.',
          },
        };
      }
      return applyEvaluationOutcome(state, record);
    }

    case InterviewEventType.EVALUATION_FAILED: {
      if (context.lifecycleState !== InterviewLifecycleState.EVALUATING_RESPONSE) {
        return state;
      }
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.QUESTION_ACTIVE,
          lastError: event.payload.error,
        },
      };
    }

    case InterviewEventType.ADVANCE_QUESTION: {
      if (context.lifecycleState !== InterviewLifecycleState.READY) {
        return state;
      }
      const nextIndex = context.currentQuestionIndex;
      if (nextIndex >= context.totalQuestions) {
        return state;
      }
      return activateQuestionState(state, nextIndex, context.sessionStartedAt);
    }

    case InterviewEventType.TERMINATE_EARLY: {
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.TERMINATED_EARLY,
          sessionEndedAt: new Date().toISOString(),
          lastError:
            event.payload.reason === 'moving_average_below_threshold'
              ? `Session ended early: moving average ${event.payload.movingAverageScore.toFixed(1)}% is below ${40}%.`
              : context.lastError,
        },
        pendingSubmission: null,
      };
    }

    case InterviewEventType.COMPLETE_INTERVIEW: {
      return {
        ...state,
        context: {
          ...context,
          lifecycleState: InterviewLifecycleState.COMPLETED,
          sessionEndedAt: new Date().toISOString(),
        },
        finalReport: event.payload.report,
        pendingSubmission: null,
      };
    }

    case InterviewEventType.RESET: {
      return createInitialEngineState(
        {
          resumeText: '',
          jobDescription: '',
          targetRole: '',
          totalQuestions: context.totalQuestions,
          perQuestionTimeLimitMs: context.perQuestionTimeLimitMs,
        },
        state.scoringWeights
      );
    }

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

function activateQuestionState(
  state: InterviewEngineState,
  questionIndex: number,
  sessionStartedAt: string | null
): InterviewEngineState {
  const { context } = state;
  const question = context.questionBank[questionIndex] ?? null;

  return {
    ...state,
    context: {
      ...context,
      lifecycleState: InterviewLifecycleState.QUESTION_ACTIVE,
      currentQuestionIndex: questionIndex,
      remainingTimeMs: question?.timeLimitMs ?? context.perQuestionTimeLimitMs,
      sessionStartedAt: sessionStartedAt ?? new Date().toISOString(),
      lastError: null,
    },
    pendingSubmission: null,
  };
}

function applyEvaluationOutcome(
  state: InterviewEngineState,
  record: InterviewEngineState['context']['responseHistory'][number]
): InterviewEngineState {
  const { context } = state;

  const accumulatedScores = [...context.accumulatedScores, record.compositeScore];
  const movingAverageScore = computeMovingAverage(accumulatedScores);
  const answeredCount = accumulatedScores.length;

  const adaptation = applyDifficultyAdaptation(
    {
      difficultyTier: context.difficultyTier,
      consecutiveHighScoreCount: context.consecutiveHighScoreCount,
      consecutiveLowScoreCount: context.consecutiveLowScoreCount,
    },
    record.compositeScore
  );

  const responseHistory = [...context.responseHistory, record];

  const baseContext: InterviewContext = {
    ...context,
    responseHistory,
    accumulatedScores,
    movingAverageScore,
    difficultyTier: adaptation.difficultyTier,
    consecutiveHighScoreCount: adaptation.consecutiveHighScoreCount,
    consecutiveLowScoreCount: adaptation.consecutiveLowScoreCount,
    lastError: null,
  };

  if (shouldTerminateEarly(answeredCount, movingAverageScore)) {
    return {
      ...state,
      context: {
        ...baseContext,
        lifecycleState: InterviewLifecycleState.TERMINATED_EARLY,
        sessionEndedAt: new Date().toISOString(),
      },
      pendingSubmission: null,
    };
  }

  const isLastQuestion =
    context.currentQuestionIndex + 1 >= context.totalQuestions;

  if (isLastQuestion) {
    return {
      ...state,
      context: {
        ...baseContext,
        lifecycleState: InterviewLifecycleState.READY,
        currentQuestionIndex: context.currentQuestionIndex + 1,
        remainingTimeMs: 0,
      },
      pendingSubmission: null,
    };
  }

  const nextIndex = context.currentQuestionIndex + 1;
  const nextQuestion = context.questionBank[nextIndex] as InterviewQuestion | undefined;

  return {
    ...state,
    context: {
      ...baseContext,
      lifecycleState: InterviewLifecycleState.QUESTION_ACTIVE,
      currentQuestionIndex: nextIndex,
      remainingTimeMs:
        nextQuestion?.timeLimitMs ?? context.perQuestionTimeLimitMs,
    },
    pendingSubmission: null,
  };
}

export function buildRecordFromPending(
  state: InterviewEngineState,
  evaluation: ResponseEvaluation
): QuestionResponseRecord | null {
  const { pendingSubmission, context, scoringWeights } = state;
  const question = context.questionBank[context.currentQuestionIndex];
  if (!pendingSubmission || !question) {
    return null;
  }

  const compositeScore = computeCompositeScore(evaluation, scoringWeights);

  return {
    questionId: question.id,
    questionIndex: question.index,
    difficultyAtAsk: context.difficultyTier,
    answerText: pendingSubmission.answerText,
    submissionStatus: pendingSubmission.submissionStatus,
    submittedAtMs: pendingSubmission.submittedAtMs,
    elapsedMs: pendingSubmission.elapsedMs,
    evaluation,
    compositeScore,
  };
}
