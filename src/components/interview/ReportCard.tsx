import { CheckCircle2, Target, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { FinalReadinessReport } from '@/types/interview';

export interface ReportCardProps {
  report: FinalReadinessReport;
  wasTerminatedEarly?: boolean;
}

const STATUS_VARIANT: Record<
  FinalReadinessReport['readinessStatus'],
  'success' | 'secondary' | 'warning'
> = {
  Strong: 'success',
  Average: 'secondary',
  'Needs Improvement': 'warning',
};

export function ReportCard({ report, wasTerminatedEarly = false }: ReportCardProps) {
  const breakdownEntries = Object.entries(report.breakdown);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="font-display text-3xl">Readiness report</CardTitle>
            <CardDescription className="mt-1">
              {wasTerminatedEarly
                ? 'Session ended early based on performance thresholds.'
                : 'Full session completed. Review your dimension scores below.'}
            </CardDescription>
          </div>
          <Badge variant={STATUS_VARIANT[report.readinessStatus]} className="text-sm">
            {report.readinessStatus}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-5xl font-semibold tabular-nums">
              {report.overallScore}
            </span>
            <span className="text-muted-foreground">/ 100 overall</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {report.isHirable ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="font-medium text-emerald-800">Hire-ready signal</span>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-amber-600" />
                <span className="font-medium text-amber-900">More preparation recommended</span>
              </>
            )}
          </div>
        </div>

        <Separator />

        <section>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="h-4 w-4" />
            Dimension breakdown
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {breakdownEntries.map(([label, score]) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{label.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="font-medium tabular-nums">{score}%</span>
                </div>
                <Progress value={score} />
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <InsightList title="Strengths" items={report.strengths} emptyLabel="No dominant strengths yet." />
          <InsightList
            title="Areas to improve"
            items={report.weaknesses}
            emptyLabel="No critical weaknesses flagged."
          />
        </div>

        <section>
          <h4 className="mb-2 text-sm font-semibold">Actionable insights</h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {report.actionableInsights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}

function InsightList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  );
}
