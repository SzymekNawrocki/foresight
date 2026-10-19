import type { AnalysisReport, PendingAnalysis } from "./analysis/pending.js";
import type { BudgetLine, TokenBudget } from "./budget/budget.js";
import { type IngestInput, runIngest, type SourceReport } from "./ingest.js";

export interface HandlerDeps extends Omit<IngestInput, "now"> {
  log: (line: string) => void;
  analysis?: {
    pending: PendingAnalysis;
    /** A fresh budget per run: its counters are read from the store, not kept across warm starts. */
    budget: () => TokenBudget;
  };
}

export interface HandlerReport {
  ingest: SourceReport[];
  /** New Events across all Sources — the alarm "no new Events" watches this number. */
  newEvents: number;
  analysis?: AnalysisReport;
  tokens?: BudgetLine[] | { error: string };
}

// The worker's hourly run. Failures stay in the report (and the log); throwing would only make
// Lambda retry the feeds. The Analysis runs after the ingest, so a Groq or key problem never
// costs us new Events.
export function createHandler({ log, analysis, ...deps }: HandlerDeps) {
  return async (): Promise<HandlerReport> => {
    const ingest = await runIngest({ ...deps, now: () => new Date() });
    const report: HandlerReport = { ingest, newEvents: ingest.reduce((sum, s) => sum + s.new, 0) };
    if (analysis) {
      const budget = analysis.budget();
      report.analysis = await analysis.pending.analyzePending(budget);
      report.tokens = await budget.report().catch((error: unknown) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
    }
    log(JSON.stringify({ msg: "ingest finished", report }));
    return report;
  };
}
