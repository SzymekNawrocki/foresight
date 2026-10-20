import type { Event } from "@foresight/shared";
import type { TokenBudget } from "../budget/budget.js";
import { estimateTokens, type Llm, type LlmFailure, type LlmRequest } from "../llm/llm.js";
import { BATCH_SIZE, DispatchBatch, looksLikeInjection, QUARANTINED, REFS, settle } from "./dispatch.js";
import { findDuplicate } from "./duplicate.js";
import { type ActiveThread, buildMessages } from "./prompt.js";
import type { AnalysisQueue } from "./queue.js";

export type AnalysisReport =
  | {
      analyzed: number;
      failed: number;
      /** Why Events failed: an LLM failure for the whole batch, or `skipped` for a dispatch missing or invalid. */
      reasons?: Partial<Record<LlmFailure | "skipped", number>>;
      quarantined?: number;
      /** Near-duplicates that took the Analysis of a recent Event, without a model call. */
      reused?: number;
      stopped?: "rate-limited" | "budget";
      backlog?: number;
    }
  | { error: string; backlog?: number };

export interface PendingAnalysis {
  /** Analyzes the newest pending Events within the token budget. Never throws. */
  analyzePending(budget: TokenBudget): Promise<AnalysisReport>;
}

export interface PendingAnalysisOptions {
  queue: AnalysisQueue;
  /** Lazy: the key is read only when something is pending. */
  llm: () => Promise<Llm>;
  /** Threads an Event may attach to; read once per run, only when there is a batch to send. */
  threads?: () => Promise<ActiveThread[]>;
  model?: string;
  /** Max Events per run — keeps one run inside the free Groq limits. */
  limit?: number;
  /** Pause between batches (≈ 8K tokens/min on the free plan, a batch spends ~3K). */
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

/** How far back a near-duplicate may be (SPEC: slice 10, step 3). */
const DUPLICATE_WINDOW_MS = 48 * 60 * 60 * 1000;

const MAX_COMPLETION_TOKENS = 3_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const noThreads = async (): Promise<ActiveThread[]> => [];

type RunReport = Extract<AnalysisReport, { analyzed: number }>;

function fail(report: RunReport, reason: LlmFailure | "skipped", count: number) {
  report.failed += count;
  report.reasons = { ...report.reasons, [reason]: (report.reasons?.[reason] ?? 0) + count };
}

// Events go to the model in batches of 5, with the instructions and the Thread list sent once
// per batch. An Event without a valid dispatch is not saved, so it stays pending for the next
// run; a 429 or an exhausted budget ends the run, because every further call would fail too.
export function createPendingAnalysis({
  queue,
  llm,
  threads = noThreads,
  model = "openai/gpt-oss-120b",
  limit = 20,
  pauseMs = 25_000,
  sleep = wait,
  now = () => new Date(),
}: PendingAnalysisOptions): PendingAnalysis {
  async function run(budget: TokenBudget) {
    const report: RunReport = { analyzed: 0, failed: 0 };
    const events = await queue.pending(limit);

    const clean = events.filter((e) => !looksLikeInjection(e.title));
    for (const event of events.filter((e) => looksLikeInjection(e.title))) {
      await queue.saveAnalysis(event.id, QUARANTINED);
      report.quarantined = (report.quarantined ?? 0) + 1;
    }
    if (clean.length === 0) return report;

    const active = await threads();
    const activeIds = new Set(active.map((t) => t.id));

    // A near-duplicate takes the Analysis of the earlier Event, settled again because its
    // Thread may have gone dormant since.
    const recent = await queue.recent(new Date(now().getTime() - DUPLICATE_WINDOW_MS).toISOString());
    const fresh: Event[] = [];
    for (const event of clean) {
      const duplicate = findDuplicate(event.title, recent);
      if (!duplicate) {
        fresh.push(event);
        continue;
      }
      await queue.saveAnalysis(event.id, settle(duplicate, activeIds));
      report.reused = (report.reused ?? 0) + 1;
    }
    if (fresh.length === 0) return report;

    const client = await llm();
    const batches = Array.from({ length: Math.ceil(fresh.length / BATCH_SIZE) }, (_, i) =>
      fresh.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
    );

    for (const [i, batch] of batches.entries()) {
      const request: LlmRequest<DispatchBatch> = {
        model,
        messages: buildMessages(batch, active),
        schema: { name: "dispatches", zod: DispatchBatch },
        maxCompletionTokens: MAX_COMPLETION_TOKENS,
      };
      if (!(await budget.reserve(model, estimateTokens(request)))) {
        report.stopped = "budget";
        break;
      }
      if (i > 0) await sleep(pauseMs);

      const result = await client.complete(request);
      if (result.usage) await budget.record(result.usage);
      if (!result.ok) {
        fail(report, result.reason, batch.length);
        if (result.reason === "rate-limited") {
          report.stopped = "rate-limited";
          break;
        }
        continue;
      }
      await saveBatch(batch, result.data, activeIds, report);
    }
    return report;
  }

  async function saveBatch(batch: Event[], answer: DispatchBatch, activeIds: Set<string>, report: RunReport) {
    for (const [i, event] of batch.entries()) {
      const found = answer.dispatches.find((d) => d?.ref === REFS[i]);
      if (!found) {
        fail(report, "skipped", 1);
        continue;
      }
      await queue.saveAnalysis(event.id, settle(found, activeIds));
      report.analyzed++;
    }
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
