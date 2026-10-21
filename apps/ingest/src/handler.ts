import type { AnalysisReport, PendingAnalysis } from "./analysis/pending.js";
import type { BudgetLine, TokenBudget } from "./budget/budget.js";
import type { ReportsRunReport, SituationReports } from "./reports/refresh.js";
import { type IngestInput, runIngest, type SourceReport } from "./ingest.js";

export interface HandlerDeps extends Omit<IngestInput, "now"> {
  log: (line: string) => void;
  now?: () => Date;
  analysis?: {
    pending: PendingAnalysis;
    /** Rolling Situation reports, after the dispatches and from the same budget. */
    reports?: SituationReports;
    /** A fresh budget per run: its counters are read from the store, not kept across warm starts. */
    budget: () => TokenBudget;
  };
}

export interface HandlerReport {
  ingest: SourceReport[];
  /** New Events across all Sources — the alarm "no new Events" watches this number. */
  newEvents: number;
  analysis?: AnalysisReport;
  reports?: ReportsRunReport;
  tokens?: BudgetLine[] | { error: string };
}

// The worker's hourly run. Failures stay in the report (and the log); throwing would only make
// Lambda retry the feeds. The Analysis runs after the ingest, so a Groq or key problem never
// costs us new Events.
export function createHandler({ log, now = () => new Date(), analysis, ...deps }: HandlerDeps) {
  return async (): Promise<HandlerReport> => {
    const ingest = await runIngest({ ...deps, now });
    const report: HandlerReport = { ingest, newEvents: ingest.reduce((sum, s) => sum + s.new, 0) };
    if (analysis) {
      const budget = analysis.budget();
      report.analysis = await analysis.pending.analyzePending(budget);
      if (analysis.reports) report.reports = await analysis.reports.refreshDue(budget);
      report.tokens = await budget.report().catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    log(JSON.stringify({ msg: "ingest finished", report, ...metrics(report, now()) }));
    return report;
  };
}

// CloudWatch Embedded Metric Format: the same log line becomes metrics for the alarms
// (infra/main/alarms.tf), without metric filters or PutMetricData calls.
function metrics(report: HandlerReport, at: Date) {
  const backlog = report.analysis?.backlog;
  const values: Record<string, number> = { NewEvents: report.newEvents };
  if (backlog !== undefined) values.AnalysisBacklog = backlog;
  return {
    _aws: {
      Timestamp: at.getTime(),
      CloudWatchMetrics: [
        {
          Namespace: "Foresight",
          Dimensions: [["Service"]],
          Metrics: Object.keys(values).map((Name) => ({ Name, Unit: "Count" })),
        },
      ],
    },
    Service: "worker",
    ...values,
  };
}
