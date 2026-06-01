import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ActiveInterviewPanel } from '@/components/interview/ActiveInterviewPanel';
import { ReportCard } from '@/components/interview/ReportCard';
import { SessionHeader } from '@/components/interview/SessionHeader';
import { SetupForm } from '@/components/interview/SetupForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DEFAULT_INTERVIEW_SETUP } from '@/config/interviewDefaults';
import { useInterviewOrchestrator } from '@/hooks/useInterviewOrchestrator';
import { InterviewLifecycleState } from '@/types/interview';

export function InterviewDashboard() {
  const {
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
  } = useInterviewOrchestrator({ setup: DEFAULT_INTERVIEW_SETUP });

  const { context } = engine;
  const [panelEvaluating, setPanelEvaluating] = useState(false);

  const isEvaluating =
    context.lifecycleState === InterviewLifecycleState.EVALUATING_RESPONSE ||
    panelEvaluating;
  const isActive =
    context.lifecycleState === InterviewLifecycleState.QUESTION_ACTIVE;
  const isTerminal = engine.isTerminal;
  const showInterview = (isActive || isEvaluating) && !isTerminal;
  const showReady =
    context.lifecycleState === InterviewLifecycleState.READY &&
    !isTerminal &&
    context.responseHistory.length < context.totalQuestions;
  const wasTerminatedEarly =
    context.lifecycleState === InterviewLifecycleState.TERMINATED_EARLY;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 md:py-12">
      <div className="space-y-2 text-center md:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          AI-powered mock interviews
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Mock Interview Studio
        </h1>
        <p className="text-muted-foreground">
          Adaptive difficulty, strict timers, and structured readiness scoring.
        </p>
      </div>

      {context.lifecycleState !== InterviewLifecycleState.IDLE && (
        <SessionHeader context={context} />
      )}

      {context.lastError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{context.lastError}</AlertDescription>
        </Alert>
      )}

      {isBusy && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Working</AlertTitle>
          <AlertDescription>{busyLabel}</AlertDescription>
        </Alert>
      )}

      {context.lifecycleState === InterviewLifecycleState.IDLE && (
        <SetupForm
          onSubmit={(input) => {
            void handleSetupSubmit(input);
          }}
          disabled={isBusy}
        />
      )}

      {context.lifecycleState === InterviewLifecycleState.PARSING_INPUTS && (
        <LoadingPanel label="Building your personalized question set…" />
      )}

      {showReady && (
        <ReadyPanel
          candidateName={context.parsedResume?.candidateName ?? 'Candidate'}
          questionCount={context.questionBank.length}
          skills={context.parsedResume?.skills ?? []}
          onBegin={handleBeginInterview}
          disabled={isBusy}
        />
      )}

      {showInterview && (
        <ActiveInterviewPanel
          engine={engine}
          isBusy={isBusy}
          latestFeedback={latestFeedback}
          onFeedback={setLatestFeedback}
          onAbort={handleAbort}
          onEvaluatingChange={setPanelEvaluating}
        />
      )}

      {isTerminal && displayReport && (
        <div className="space-y-4">
          <ReportCard report={displayReport} wasTerminatedEarly={wasTerminatedEarly} />
          <Button variant="outline" onClick={handleRestart} className="w-full">
            Start a new session
          </Button>
        </div>
      )}

      <SessionFinalizeEffect
        lifecycleState={context.lifecycleState}
        answeredCount={context.responseHistory.length}
        totalQuestions={context.totalQuestions}
        onFinalize={finalizeSessionIfNeeded}
      />
    </div>
  );
}

function SessionFinalizeEffect({
  lifecycleState,
  answeredCount,
  totalQuestions,
  onFinalize,
}: {
  lifecycleState: InterviewLifecycleState;
  answeredCount: number;
  totalQuestions: number;
  onFinalize: () => void;
}) {
  useEffect(() => {
    if (
      lifecycleState === InterviewLifecycleState.READY &&
      totalQuestions > 0 &&
      answeredCount >= totalQuestions
    ) {
      onFinalize();
    }
  }, [lifecycleState, answeredCount, totalQuestions, onFinalize]);

  return null;
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </CardContent>
    </Card>
  );
}

function ReadyPanel({
  candidateName,
  questionCount,
  skills,
  onBegin,
  disabled,
}: {
  candidateName: string;
  questionCount: number;
  skills: string[];
  onBegin: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Ready when you are, {candidateName}</CardTitle>
        <CardDescription>
          {questionCount} adaptive questions prepared from your resume and job description.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {skills.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Detected focus: {skills.slice(0, 6).join(', ')}
            {skills.length > 6 ? '…' : ''}
          </p>
        )}
        <Button onClick={onBegin} disabled={disabled} className="w-full">
          Begin interview
        </Button>
      </CardContent>
    </Card>
  );
}
