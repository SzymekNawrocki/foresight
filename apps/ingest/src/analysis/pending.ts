import { Analysis } from "@foresight/shared";
import type { TokenBudget } from "../budget/budget.js";
import { estimateTokens, type Llm, type LlmRequest } from "../llm/llm.js";
import { buildMessages } from "./prompt.js";
import type { AnalysisQueue } from "./queue.js";

export type AnalysisReport =
  | { analyzed: number; failed: number; stopped?: "rate-limited" | "budget"; backlog?: number }
  | { error: string; backlog?: number };

export interface PendingAnalysis {
  /** Analyzes the newest pending Events within the token budget. Never throws. */
  analyzePending(budget: TokenBudget): Promise<AnalysisReport>;
}

export interface PendingAnalysisOptions {
  queue: AnalysisQueue;
  /** Lazy: the key is read only when something is pending. */
  llm: () => Promise<Llm>;
  model?: string;
  /** Max LLM calls per run — keeps one run inside the free Groq limits. */
  limit?: number;
  /** Pause between calls (≈ 8K tokens/min on the free plan). */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const MAX_COMPLETION_TOKENS = 2_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Events are analyzed one by one. A failed Event is not saved, so it stays pending for the
// next run; a 429 or an exhausted budget ends the run, because every further call would fail too.
export function createPendingAnalysis({
  queue,
  llm,
  model = "openai/gpt-oss-20b",
  limit = 10,
  pauseMs = 12_000,
  sleep = wait,
}: PendingAnalysisOptions): PendingAnalysis {
  async function run(budget: TokenBudget) {
    const report = { analyzed: 0, failed: 0 } as { analyzed: number; failed: number; stopped?: "rate-limited" | "budget" };
    const events = await queue.pending(limit);
    if (events.length === 0) return report;
    const client = await llm();

    for (const [i, event] of events.entries()) {
      const request: LlmRequest<Analysis> = {
        model,
        messages: buildMessages(event),
        schema: { name: "analysis", zod: Analysis },
        maxCompletionTokens: MAX_COMPLETION_TOKENS,
      };
      if (!(await budget.reserve(model, estimateTokens(request)))) {
        report.stopped = "budget";
        break;
      }
      if (i > 0) await sleep(pauseMs);

      const result = await client.complete(request);
      if (result.usage) await budget.record(result.usage);
      if (result.ok) {
        await queue.saveAnalysis(event.id, result.data);
        report.analyzed++;
        continue;
      }
      report.failed++;
      if (result.reason === "rate-limited") {
        report.stopped = "rate-limited";
        break;
      }
    }
    return report;
  }

  return {
    async analyzePending(budget) {
      let report: AnalysisReport;
      try {
        report = await run(budget);
      } catch (error) {
        report = { error: error instanceof Error ? error.message : String(error) };
      }
      // Counted even after a failure: a growing backlog is exactly what the alarm must see.
      try {
        return { ...report, backlog: await queue.backlog() };
      } catch {
        return report;
      }
    },
  };
}
