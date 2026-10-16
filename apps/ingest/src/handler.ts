import type { AnalysisQueue, Analyzer } from "./analysis/analyzer.js";
import { analyzeBatch, type BatchReport } from "./analysis/batch.js";
import { type IngestInput, runIngest, type SourceReport } from "./ingest.js";

export interface AnalysisDeps {
  queue: AnalysisQueue;
  /** Lazy: the key is read only when something is pending. */
  analyzer: () => Promise<Analyzer>;
  limit?: number;
  pauseMs?: number;
}

export interface HandlerDeps extends Omit<IngestInput, "now"> {
  log: (line: string) => void;
  analysis?: AnalysisDeps;
}

export interface HandlerReport {
  ingest: SourceReport[];
  analysis?: BatchReport | { error: string };
}

// Failures stay in the report (and the log); throwing would only make Lambda retry the feeds.
// The Analysis runs after the ingest, so a Groq or key problem never costs us new Events.
export function createHandler({ log, analysis, ...deps }: HandlerDeps) {
  return async (): Promise<HandlerReport> => {
    const report: HandlerReport = { ingest: await runIngest({ ...deps, now: () => new Date() }) };
    if (analysis) report.analysis = await analyzePending(analysis);
    log(JSON.stringify({ msg: "ingest finished", report }));
    return report;
  };
}

async function analyzePending({ queue, analyzer, limit = 10, pauseMs }: AnalysisDeps) {
  try {
    const events = await queue.pending(limit);
    if (events.length === 0) return { analyzed: 0, failed: 0, stoppedOnRateLimit: false };
    const pause = pauseMs === undefined ? {} : { pauseMs };
    return await analyzeBatch({ events, analyzer: await analyzer(), store: queue, limit, ...pause });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
