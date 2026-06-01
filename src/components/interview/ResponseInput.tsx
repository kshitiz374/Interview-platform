import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { TimerState } from '@/types/interview';
import { formatMilliseconds } from '@/utils/formatTime';

export interface ResponseInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  timerState: TimerState;
  disabled?: boolean;
  isSubmitting?: boolean;
  placeholder?: string;
}

export function ResponseInput({
  value,
  onChange,
  onSubmit,
  timerState,
  disabled = false,
  isSubmitting = false,
  placeholder = 'Type your answer here. Be specific and use examples where possible.',
}: ResponseInputProps) {
  const progressPercent =
    timerState.totalMs > 0
      ? ((timerState.totalMs - timerState.remainingMs) / timerState.totalMs) * 100
      : 0;

  const isLowTime = timerState.remainingMs < timerState.totalMs * 0.2;
  const canSend = value.trim().length > 0 && !disabled && !isSubmitting;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Your response</CardTitle>
        <div
          className={cn(
            'font-mono text-lg font-semibold tabular-nums',
            isLowTime && 'text-destructive'
          )}
        >
          {formatMilliseconds(timerState.remainingMs)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isLowTime ? 'bg-destructive' : 'bg-primary'
            )}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled || isSubmitting}
          className="min-h-[160px] resize-y"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canSend) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Press Ctrl+Enter to submit · Timer uses millisecond precision
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={onSubmit} disabled={!canSend} className="w-full sm:w-auto">
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Submit answer
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
