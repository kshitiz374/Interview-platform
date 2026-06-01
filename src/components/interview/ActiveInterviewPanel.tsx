import { Brain } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QuestionDisplay } from '@/components/interview/QuestionDisplay';
import { ResponseInput } from '@/components/interview/ResponseInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useInterviewTimer } from '@/hooks/useInterviewTimer';
import type { UseInterviewEngineResult } from '@/hooks/useInterviewEngine';
import { aiService } from '@/services/aiService';
import { InterviewLifecycleState } from '@/types/interview';
import { createTimeoutEvaluation } from '@/utils/scoringAlgorithms';

export interface ActiveInterviewPanelProps {
  engine: UseInterviewEngineResult;
  isBusy: boolean;
  latestFeedback: string | null;
  onFeedback: (feedback: string) => void;
  onAbort: () => void;
  onEvaluatingChange?: (evaluating: boolean) => void;
}

export function ActiveInterviewPanel({
  engine,
  isBusy,
  latestFeedback,
  onFeedback,
  onAbort,
  onEvaluatingChange,
}: ActiveInterviewPanelProps) {
  const { context, currentQuestion, canSubmit } = engine;
  const [draftAnswer, setDraftAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const questionTimeLimitMs =
    currentQuestion?.timeLimitMs ?? context.perQuestionTimeLimitMs;

  const handleTimeoutRef = useRef<() => void>(() => undefined);

  const timer = useInterviewTimer({
    durationMs: questionTimeLimitMs,
    onExpire: () => handleTimeoutRef.current(),
  });

  const activatedQuestionRef = useRef(-1);
  const timerApiRef = useRef(timer);
  timerApiRef.current = timer;

  useEffect(() => {
    onEvaluatingChange?.(isEvaluating);
  }, [isEvaluating, onEvaluatingChange]);

  useEffect(() => {
    if (context.lifecycleState !== InterviewLifecycleState.QUESTION_ACTIVE) {
      return;
    }
    if (activatedQuestionRef.current === context.currentQuestionIndex) {
      return;
    }
    activatedQuestionRef.current = context.currentQuestionIndex;
    timerApiRef.current.reset(questionTimeLimitMs);
    timerApiRef.current.start();
  }, [context.lifecycleState, context.currentQuestionIndex, questionTimeLimitMs]);

  const runTimeout = useCallback(() => {
    if (engine.context.lifecycleState !== InterviewLifecycleState.QUESTION_ACTIVE) {
      return;
    }
    timer.pause();
    const elapsedMs = timer.timerState.elapsedMs;
    engine.handleTimerExpiry(elapsedMs);
    onFeedback(createTimeoutEvaluation().feedback);
    setDraftAnswer('');
  }, [engine, timer, onFeedback]);

  handleTimeoutRef.current = runTimeout;

  const handleSubmit = useCallback(async () => {
    if (engine.context.lifecycleState !== InterviewLifecycleState.QUESTION_ACTIVE) {
      return;
    }

    const question = engine.currentQuestion;
    if (!question) {
      return;
    }

    const answerText = draftAnswer;
    timer.pause();
    const elapsedMs = timer.timerState.elapsedMs;

    setDraftAnswer('');
    engine.submitAnswer(answerText, elapsedMs);
    setIsEvaluating(true);

    const evalResult = await aiService.evaluateResponse({
      question,
      answerText,
      submissionStatus: 'complete',
      elapsedMs,
      timeLimitMs: question.timeLimitMs,
    });

    setIsEvaluating(false);

    if (!evalResult.success) {
      engine.failEvaluation(evalResult.error.message);
      return;
    }

    engine.applyEvaluation(evalResult.data);
    onFeedback(evalResult.data.feedback);
  }, [draftAnswer, engine, onFeedback, timer]);

  if (!currentQuestion) {
    return null;
  }

  const isEvaluatingState =
    context.lifecycleState === InterviewLifecycleState.EVALUATING_RESPONSE;

  return (
    <div className="space-y-4">
      <QuestionDisplay
        question={currentQuestion}
        questionNumber={context.currentQuestionIndex + 1}
        totalQuestions={context.totalQuestions}
        difficultyTier={context.difficultyTier}
      />

      {latestFeedback && (
        <Alert>
          <Brain className="h-4 w-4" />
          <AlertTitle>Previous feedback</AlertTitle>
          <AlertDescription>{latestFeedback}</AlertDescription>
        </Alert>
      )}

      <ResponseInput
        value={draftAnswer}
        onChange={setDraftAnswer}
        onSubmit={() => {
          void handleSubmit();
        }}
        timerState={timer.timerState}
        disabled={!canSubmit || isEvaluatingState}
        isSubmitting={isEvaluatingState || isEvaluating || isBusy}
      />

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={onAbort}
        disabled={isEvaluatingState || isEvaluating || isBusy}
      >
        End session early
      </Button>
    </div>
  );
}
