import {
  DEFAULT_SCORING_WEIGHTS,
  DifficultyLevel,
  getNextDifficultyTier,
  SCORING_THRESHOLDS,
  type AnswerSubmissionStatus,
  type FinalReadinessReport,
  type QuestionResponseRecord,
  type ReadinessStatus,
  type ResponseEvaluation,
  type ScoringWeights,
} from '@/types/interview';

export const READINESS_THRESHOLDS = {
  STRONG: 75,
  AVERAGE: 50,
  HIRABLE: 70,
  CRITICAL_DIMENSION_FLOOR: 40,
} as const;

export interface TimeEfficiencyInput {
  elapsedMs: number;
  timeLimitMs: number;
  submissionStatus: AnswerSubmissionStatus;
}

/** Clamp a metric into the canonical 0–100 range. */
export function clampMetric(value: number): number {
  return Math.min(
    SCORING_THRESHOLDS.MAX_METRIC,
    Math.max(SCORING_THRESHOLDS.MIN_METRIC, Math.round(value))
  );
}

/** Weighted composite score across evaluation dimensions. */
export function computeCompositeScore(
  evaluation: ResponseEvaluation,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  const raw =
    evaluation.accuracy * weights.accuracy +
    evaluation.clarity * weights.clarity +
    evaluation.depth * weights.depth +
    evaluation.relevance * weights.relevance +
    evaluation.timeEfficiency * weights.timeEfficiency;

  return clampMetric(raw);
}

/** Arithmetic mean of all recorded composite scores (0 when empty). */
export function computeMovingAverage(scores: readonly number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return clampMetric(sum / scores.length);
}

export interface AdaptationState {
  difficultyTier: DifficultyLevel;
  consecutiveHighScoreCount: number;
  consecutiveLowScoreCount: number;
}

/**
 * Deterministic tier adaptation after a scored response.
 * - Two consecutive scores >= 80% promote one tier.
 * - Two consecutive scores < 50% demote one tier.
 */
export function applyDifficultyAdaptation(
  current: AdaptationState,
  compositeScore: number
): AdaptationState {
  let { difficultyTier, consecutiveHighScoreCount, consecutiveLowScoreCount } =
    current;

  if (compositeScore >= SCORING_THRESHOLDS.HIGH_SCORE) {
    consecutiveHighScoreCount += 1;
    consecutiveLowScoreCount = 0;
  } else if (compositeScore < SCORING_THRESHOLDS.LOW_SCORE) {
    consecutiveLowScoreCount += 1;
    consecutiveHighScoreCount = 0;
  } else {
    consecutiveHighScoreCount = 0;
    consecutiveLowScoreCount = 0;
  }

  if (
    consecutiveHighScoreCount >=
    SCORING_THRESHOLDS.CONSECUTIVE_HIGH_FOR_PROMOTION
  ) {
    difficultyTier = getNextDifficultyTier(difficultyTier, 'up');
    consecutiveHighScoreCount = 0;
  }

  if (
    consecutiveLowScoreCount >= SCORING_THRESHOLDS.CONSECUTIVE_LOW_FOR_DEMOTION
  ) {
    difficultyTier = getNextDifficultyTier(difficultyTier, 'down');
    consecutiveLowScoreCount = 0;
  }

  return {
    difficultyTier,
    consecutiveHighScoreCount,
    consecutiveLowScoreCount,
  };
}

/**
 * Early termination gate: moving average below 40% after at least 3 answers.
 */
export function shouldTerminateEarly(
  answeredCount: number,
  movingAverageScore: number
): boolean {
  return (
    answeredCount >= SCORING_THRESHOLDS.EARLY_TERMINATION_MIN_QUESTIONS &&
    movingAverageScore < SCORING_THRESHOLDS.EARLY_TERMINATION_AVERAGE
  );
}

/**
 * Deterministic time-efficiency score (0–100).
 * Timeout submissions always receive 0%.
 */
export function computeTimeEfficiencyScore(input: TimeEfficiencyInput): number {
  if (input.submissionStatus === 'timeout') {
    return SCORING_THRESHOLDS.TIMEOUT_SCORE;
  }

  if (input.timeLimitMs <= 0) {
    return SCORING_THRESHOLDS.MAX_METRIC;
  }

  const ratio = input.elapsedMs / input.timeLimitMs;

  if (ratio <= 0.5) {
    return SCORING_THRESHOLDS.MAX_METRIC;
  }
  if (ratio <= 0.75) {
    return 85;
  }
  if (ratio <= 1) {
    return clampMetric(100 - (ratio - 0.75) * 160);
  }

  return SCORING_THRESHOLDS.TIMEOUT_SCORE;
}

/** Merges AI content scores with deterministic time-efficiency. */
export function applyTimeEfficiencyToEvaluation(
  evaluation: ResponseEvaluation,
  input: TimeEfficiencyInput
): ResponseEvaluation {
  return {
    ...evaluation,
    timeEfficiency: computeTimeEfficiencyScore(input),
  };
}

/** Deterministic evaluation payload when the per-question timer expires. */
export function createTimeoutEvaluation(): ResponseEvaluation {
  return {
    accuracy: SCORING_THRESHOLDS.TIMEOUT_SCORE,
    clarity: SCORING_THRESHOLDS.TIMEOUT_SCORE,
    depth: SCORING_THRESHOLDS.TIMEOUT_SCORE,
    relevance: SCORING_THRESHOLDS.TIMEOUT_SCORE,
    timeEfficiency: SCORING_THRESHOLDS.TIMEOUT_SCORE,
    feedback:
      'Response marked incomplete due to timeout. Time efficiency scored at 0%.',
  };
}

export interface DimensionBreakdown {
  accuracy: number;
  clarity: number;
  depth: number;
  relevance: number;
  timeEfficiency: number;
}

export function aggregateDimensionBreakdown(
  history: readonly QuestionResponseRecord[]
): DimensionBreakdown {
  if (history.length === 0) {
    return {
      accuracy: 0,
      clarity: 0,
      depth: 0,
      relevance: 0,
      timeEfficiency: 0,
    };
  }

  const totals = history.reduce(
    (acc, record) => ({
      accuracy: acc.accuracy + record.evaluation.accuracy,
      clarity: acc.clarity + record.evaluation.clarity,
      depth: acc.depth + record.evaluation.depth,
      relevance: acc.relevance + record.evaluation.relevance,
      timeEfficiency: acc.timeEfficiency + record.evaluation.timeEfficiency,
    }),
    { accuracy: 0, clarity: 0, depth: 0, relevance: 0, timeEfficiency: 0 }
  );

  const count = history.length;
  return {
    accuracy: clampMetric(totals.accuracy / count),
    clarity: clampMetric(totals.clarity / count),
    depth: clampMetric(totals.depth / count),
    relevance: clampMetric(totals.relevance / count),
    timeEfficiency: clampMetric(totals.timeEfficiency / count),
  };
}

export function deriveReadinessStatus(overallScore: number): ReadinessStatus {
  if (overallScore >= READINESS_THRESHOLDS.STRONG) {
    return 'Strong';
  }
  if (overallScore >= READINESS_THRESHOLDS.AVERAGE) {
    return 'Average';
  }
  return 'Needs Improvement';
}

function identifyStrengthsAndWeaknesses(
  breakdown: DimensionBreakdown
): { strengths: string[]; weaknesses: string[] } {
  const entries = Object.entries(breakdown) as [keyof DimensionBreakdown, number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const strengths = sorted
    .filter(([, score]) => score >= READINESS_THRESHOLDS.STRONG)
    .slice(0, 2)
    .map(([dimension]) => formatDimensionLabel(dimension));
  const weaknesses = sorted
    .filter(([, score]) => score < READINESS_THRESHOLDS.AVERAGE)
    .slice(-2)
    .map(([dimension]) => formatDimensionLabel(dimension));

  return { strengths, weaknesses };
}

function formatDimensionLabel(dimension: keyof DimensionBreakdown): string {
  const labels: Record<keyof DimensionBreakdown, string> = {
    accuracy: 'Technical accuracy',
    clarity: 'Answer clarity',
    depth: 'Answer depth',
    relevance: 'Role relevance',
    timeEfficiency: 'Time efficiency',
  };
  return labels[dimension];
}

function buildActionableInsights(
  breakdown: DimensionBreakdown,
  readinessStatus: ReadinessStatus
): string[] {
  const insights: string[] = [];

  if (breakdown.depth < READINESS_THRESHOLDS.AVERAGE) {
    insights.push('Use STAR format with measurable outcomes to increase answer depth.');
  }
  if (breakdown.timeEfficiency < READINESS_THRESHOLDS.AVERAGE) {
    insights.push('Practice timed responses to improve pacing under interview pressure.');
  }
  if (breakdown.accuracy < READINESS_THRESHOLDS.AVERAGE) {
    insights.push('Review core role fundamentals and validate assumptions before answering.');
  }
  if (readinessStatus === 'Strong') {
    insights.push('Maintain consistency by rehearsing higher-difficulty follow-up questions.');
  }
  if (insights.length === 0) {
    insights.push('Continue mock sessions weekly and track dimension trends over time.');
  }

  return insights;
}

export function buildFinalReadinessReport(
  history: readonly QuestionResponseRecord[]
): FinalReadinessReport {
  const compositeScores = history.map((record) => record.compositeScore);
  const overallScore = computeMovingAverage(compositeScores);
  const breakdown = aggregateDimensionBreakdown(history);
  const readinessStatus = deriveReadinessStatus(overallScore);
  const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(breakdown);

  const dimensionValues = Object.values(breakdown);
  const hasCriticalWeakness = dimensionValues.some(
    (score) => score < READINESS_THRESHOLDS.CRITICAL_DIMENSION_FLOOR
  );

  const isHirable =
    overallScore >= READINESS_THRESHOLDS.HIRABLE && !hasCriticalWeakness;

  return {
    overallScore,
    readinessStatus,
    breakdown: {
      accuracy: breakdown.accuracy,
      clarity: breakdown.clarity,
      depth: breakdown.depth,
      relevance: breakdown.relevance,
      timeEfficiency: breakdown.timeEfficiency,
    },
    strengths,
    weaknesses,
    actionableInsights: buildActionableInsights(breakdown, readinessStatus),
    isHirable,
  };
}

export function buildResponseRecord(params: {
  questionId: string;
  questionIndex: number;
  difficultyAtAsk: DifficultyLevel;
  answerText: string;
  submissionStatus: QuestionResponseRecord['submissionStatus'];
  submittedAtMs: number;
  elapsedMs: number;
  evaluation: ResponseEvaluation;
  compositeScore: number;
}): QuestionResponseRecord {
  return {
    questionId: params.questionId,
    questionIndex: params.questionIndex,
    difficultyAtAsk: params.difficultyAtAsk,
    answerText: params.answerText,
    submissionStatus: params.submissionStatus,
    submittedAtMs: params.submittedAtMs,
    elapsedMs: params.elapsedMs,
    evaluation: params.evaluation,
    compositeScore: params.compositeScore,
  };
}
