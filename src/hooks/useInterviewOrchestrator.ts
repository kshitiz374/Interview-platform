import { useCallback, useMemo, useRef, useState } from 'react';
import { useInterviewEngine, type UseInterviewEngineResult } from '@/hooks/useInterviewEngine';
import { prepareInterviewSession } from '@/services/interviewSession';
import {
  InterviewLifecycleState,
  type FinalReadinessReport,
  type InterviewSetupInput,
  type UseInterviewEngineOptions,
} from '@/types/interview';
import { buildFinalReadinessReport } from '@/utils/scoringAlgorithms';

export interface UseInterviewOrchestratorOptions {
  setup: InterviewSetupInput;
}

export interface UseInterviewOrchestratorReturn {
  engine: UseInterviewEngineResult;
  displayReport: FinalReadinessReport | null;
  isBusy: boolean;
  busyLabel: string;
  latestFeedback: string | null;
  setLatestFeedback: (feedback: string | null) => void;
  handleSetupSubmit: (input: {
    resumeText: string;
    jobDescription: string;
    targetRole: string;
  }) => Promise<void>;
  handleBeginInterview: () => void;
  handleAbort: () => void;
  handleRestart: () => void;
  finalizeSessionIfNeeded: () => void;
}

export function useInterviewOrchestrator(
  options: UseInterviewOrchestratorOptions
): UseInterviewOrchestratorReturn {
  const engine = useInterviewEngine({ setup: options.setup } satisfies UseInterviewEngineOptions);
  const { context, finalReport, isTerminal } = engine;

  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [latestFeedback, setLatestFeedback] = useState<string | null>(null);

  const hasFinalizedRef = useRef(false);

  const displayReport = useMemo(() => {
    if (finalReport) {
      return finalReport;
    }
    if (isTerminal && context.responseHistory.length > 0) {
      return buildFinalReadinessReport(context.responseHistory);
    }
    return null;
  }, [finalReport, isTerminal, context.responseHistory]);

  const completeInterviewRef = useRef(engine.completeInterview);
  completeInterviewRef.current = engine.completeInterview;

  const finalizeSessionIfNeeded = useCallback(() => {
    const isSessionComplete =
      context.lifecycleState === InterviewLifecycleState.READY &&
      context.totalQuestions > 0 &&
      context.responseHistory.length >= context.totalQuestions &&
      !finalReport &&
      !hasFinalizedRef.current;

    if (!isSessionComplete) {
      return;
    }

    hasFinalizedRef.current = true;
    const report = buildFinalReadinessReport(context.responseHistory);
    completeInterviewRef.current(report);
  }, [
    context.lifecycleState,
    context.responseHistory,
    context.totalQuestions,
    finalReport,
  ]);

  const handleSetupSubmit = useCallback(
    async (input: {
      resumeText: string;
      jobDescription: string;
      targetRole: string;
    }) => {
      engine.startParsing(input);
      setIsBusy(true);
      setBusyLabel('Parsing resume and generating questions…');

      const result = await prepareInterviewSession({
        ...options.setup,
        resumeText: input.resumeText,
        jobDescription: input.jobDescription,
        targetRole: input.targetRole,
      });

      setIsBusy(false);
      setBusyLabel('');

      if (result.success) {
        engine.completeParsing(result.data.parsedResume, result.data.questionBank);
        return;
      }

      engine.failParsing(result.error.message, result.error.retryable);
    },
    [engine, options.setup]
  );

  const handleBeginInterview = useCallback(() => {
    setLatestFeedback(null);
    hasFinalizedRef.current = false;
    engine.beginInterview();
  }, [engine]);

  const handleAbort = useCallback(() => {
    engine.terminateEarly('user_aborted');
  }, [engine]);

  const handleRestart = useCallback(() => {
    setLatestFeedback(null);
    setIsBusy(false);
    setBusyLabel('');
    hasFinalizedRef.current = false;
    engine.reset();
  }, [engine]);

  return {
    engine,
    displayReport,
    isBusy,
    busyLabel,
    latestFeedback,
    setLatestFeedback,
    handleSetupSubmit,
    handleBeginInterview,
    handleAbort,
    handleRestart,
    finalizeSessionIfNeeded,
  };
}
