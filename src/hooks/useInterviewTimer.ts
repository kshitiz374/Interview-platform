import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TimerStatus,
  type TimerState,
  type UseInterviewTimerOptions,
  type UseInterviewTimerReturn,
} from '@/types/interview';

const TICK_INTERVAL_MS = 50;

const createIdleState = (totalMs: number): TimerState => ({
  status: TimerStatus.IDLE,
  remainingMs: totalMs,
  totalMs,
  elapsedMs: 0,
});

/** Countdown driven by a `performance.now()` deadline to limit timer drift. */
export function useInterviewTimer(
  options: UseInterviewTimerOptions
): UseInterviewTimerReturn {
  const { durationMs, onExpire, autoStart = false } = options;

  const [timerState, setTimerState] = useState<TimerState>(() =>
    createIdleState(durationMs)
  );

  const deadlineRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  const totalMsRef = useRef(durationMs);

  onExpireRef.current = onExpire;
  totalMsRef.current = durationMs;

  const clearTickInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const syncFromDeadline = useCallback((): boolean => {
    const deadline = deadlineRef.current;
    if (deadline === null) {
      return false;
    }

    const now = performance.now();
    const remainingMs = Math.max(0, deadline - now);
    const elapsedMs = Math.min(totalMsRef.current, totalMsRef.current - remainingMs);

    if (remainingMs <= 0) {
      clearTickInterval();
      deadlineRef.current = null;
      setTimerState({
        status: TimerStatus.EXPIRED,
        remainingMs: 0,
        totalMs: totalMsRef.current,
        elapsedMs: totalMsRef.current,
      });
      onExpireRef.current();
      return true;
    }

    setTimerState({
      status: TimerStatus.RUNNING,
      remainingMs,
      totalMs: totalMsRef.current,
      elapsedMs,
    });
    return false;
  }, [clearTickInterval]);

  const startInterval = useCallback(() => {
    clearTickInterval();
    intervalRef.current = setInterval(() => {
      syncFromDeadline();
    }, TICK_INTERVAL_MS);
  }, [clearTickInterval, syncFromDeadline]);

  const start = useCallback(() => {
    clearTickInterval();
    const total = totalMsRef.current;
    deadlineRef.current = performance.now() + total;
    setTimerState({
      status: TimerStatus.RUNNING,
      remainingMs: total,
      totalMs: total,
      elapsedMs: 0,
    });
    startInterval();
  }, [clearTickInterval, startInterval]);

  const pause = useCallback(() => {
    const deadline = deadlineRef.current;
    if (deadline === null) {
      return;
    }

    clearTickInterval();
    const remainingMs = Math.max(0, deadline - performance.now());
    deadlineRef.current = null;

    setTimerState((prev) => ({
      ...prev,
      status: TimerStatus.PAUSED,
      remainingMs,
      elapsedMs: totalMsRef.current - remainingMs,
    }));
  }, [clearTickInterval]);

  const reset = useCallback(
    (nextDurationMs?: number) => {
      clearTickInterval();
      deadlineRef.current = null;

      const total = nextDurationMs ?? totalMsRef.current;
      totalMsRef.current = total;
      setTimerState(createIdleState(total));
    },
    [clearTickInterval]
  );

  useEffect(() => {
    totalMsRef.current = durationMs;
    if (deadlineRef.current === null) {
      setTimerState(createIdleState(durationMs));
    }
  }, [durationMs]);

  useEffect(() => {
    if (autoStart && durationMs > 0) {
      start();
    }
  }, [autoStart, durationMs, start]);

  useEffect(() => clearTickInterval, [clearTickInterval]);

  const isExpired = timerState.status === TimerStatus.EXPIRED;

  return {
    timerState,
    start,
    pause,
    reset,
    isExpired,
  };
}
