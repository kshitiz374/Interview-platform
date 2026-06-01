import { SCORING_THRESHOLDS } from '@/types/interview';

export function clampMetric(value: number): number {
  return Math.min(
    SCORING_THRESHOLDS.MAX_METRIC,
    Math.max(SCORING_THRESHOLDS.MIN_METRIC, Math.round(value))
  );
}
