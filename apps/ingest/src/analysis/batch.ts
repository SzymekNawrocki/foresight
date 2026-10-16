import type { Event } from "@foresight/shared";
import type { AnalysisStore, Analyzer } from "./analyzer.js";

export interface BatchInput {
  events: readonly Event[];
  analyzer: Analyzer;
  store: AnalysisStore;
  /** Max LLM calls per run — keeps one run inside the free Groq limits. */
  limit?: number;
  /** Pause between calls (≈ 8K tokens/min on the free plan). */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface BatchReport {
  analyzed: number;
  failed: number;
  stoppedOnRateLimit: boolean;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Events are analyzed one by one. A failed Event is not saved, so it stays pending for the
// next run; a 429 ends the run, because every further call would fail too.
export async function analyzeBatch({
  events,
  analyzer,
  store,
  limit = 10,
  pauseMs = 12_000,
  sleep = wait,
}: BatchInput): Promise<BatchReport> {
  const report: BatchReport = { analyzed: 0, failed: 0, stoppedOnRateLimit: false };
  const batch = events.slice(0, limit);

  for (const [i, event] of batch.entries()) {
    if (i > 0) await sleep(pauseMs);
    const result = await analyzer.analyze(event);
    if (result.ok) {
      await store.saveAnalysis(event.id, result.analysis);
      report.analyzed++;
      continue;
    }
    report.failed++;
    if (result.reason === "rate-limited") {
      report.stoppedOnRateLimit = true;
      break;
    }
  }
  return report;
}
