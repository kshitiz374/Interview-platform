import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { InterviewContext } from '@/types/interview';
import { InterviewLifecycleState } from '@/types/interview';

export interface SessionHeaderProps {
  context: InterviewContext;
}

const STATE_LABELS: Partial<Record<InterviewLifecycleState, string>> = {
  [InterviewLifecycleState.PARSING_INPUTS]: 'Preparing',
  [InterviewLifecycleState.READY]: 'Ready',
  [InterviewLifecycleState.QUESTION_ACTIVE]: 'In progress',
  [InterviewLifecycleState.EVALUATING_RESPONSE]: 'Evaluating',
  [InterviewLifecycleState.COMPLETED]: 'Completed',
  [InterviewLifecycleState.TERMINATED_EARLY]: 'Ended early',
};

export function SessionHeader({ context }: SessionHeaderProps) {
  const answered = context.responseHistory.length;
  const total = context.totalQuestions;
  const progressValue = total > 0 ? (answered / total) * 100 : 0;

  return (
    <header className="space-y-3 rounded-lg border bg-card/80 p-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STATE_LABELS[context.lifecycleState] ?? 'Idle'}</Badge>
          <Badge variant="secondary">Tier: {context.difficultyTier}</Badge>
        </div>
        {answered > 0 && (
          <p className="text-sm text-muted-foreground">
            Moving avg:{' '}
            <span className="font-semibold text-foreground tabular-nums">
              {context.movingAverageScore}%
            </span>
          </p>
        )}
      </div>
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {answered} / {total} answered
            </span>
            <span>{Math.round(progressValue)}%</span>
          </div>
          <Progress value={progressValue} />
        </div>
      )}
    </header>
  );
}
