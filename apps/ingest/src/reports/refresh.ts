import { isDormant, type Thread } from "@foresight/shared";
import type { TokenBudget } from "../budget/budget.js";
import { estimateTokens, type Llm, type LlmFailure, type LlmRequest } from "../llm/llm.js";
import type { ThreadStore } from "../threads/store.js";
import { buildReportMessages, MAX_REPORT_EVENTS, ReportAnswer, settleReport, summarize } from "./report.js";

export type ReportsRunReport =
  | {
      refreshed: number;
      failed: number;
      reasons?: Partial<Record<LlmFailure | "unsettled", number>>;
      /** Lit signals dropped for missing or tier C evidence. */
      rejectedSignals?: number;
      stopped?: "rate-limited" | "budget";
      /** Threads still due after this run. */
      due: number;
    }
  | { error: string };

export interface SituationReports {
  /** Refreshes the most pressing due reports within the token budget. Never throws. */
  refreshDue(budget: TokenBudget): Promise<ReportsRunReport>;
}

export interface SituationReportsOptions {
  store: ThreadStore;
  llm: () => Promise<Llm>;
  model?: string;
  /** The budget counter reports spend from (same Groq model as the dispatches, own share). */
  lane?: string;
  /** Reports per run: ~1 per minute fits 8K tokens/min, and the run must end inside 15 min. */
  limit?: number;
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

/** A Thread gets a new version at most once a day (ADR 0009). */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_COMPLETION_TOKENS = 4_000;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Active Threads with new Events and no report in 24 h, highest new Weight first. */
export function dueThreads(threads: Thread[], now: Date): Thread[] {
  return threads
    .filter(
      (t) =>
        t.status === "active" &&
        !isDormant(t, now) &&
        t.newEvents > 0 &&
        (!t.reportedAt || now.getTime() - Date.parse(t.reportedAt) >= REFRESH_AFTER_MS),
    )
    .toSorted((a, b) => b.newWeight - a.newWeight || b.newEvents - a.newEvents || b.lastEventAt.localeCompare(a.lastEventAt));
}

export function createSituationReports({
  store,
  llm,
  model = "openai/gpt-oss-120b",
  lane = model,
  limit = 3,
  pauseMs = 60_000,
  sleep = wait,
  now = () => new Date(),
}: SituationReportsOptions): SituationReports {
  async function run(budget: TokenBudget) {
    const due = dueThreads(await store.list(), now());
    const report: Extract<ReportsRunReport, { refreshed: number }> = { refreshed: 0, failed: 0, due: due.length };
    if (due.length === 0) return report;
    const client = await llm();

    for (const [i, thread] of due.slice(0, limit).entries()) {
      const previous = await store.latestReport(thread.id);
      const entries = (await store.timeline(thread.id, 100))
        .filter((e) => !previous || e.linkedAt > previous.createdAt)
        .slice(0, MAX_REPORT_EVENTS);
      if (entries.length === 0) continue;

      const request: LlmRequest<ReportAnswer> = {
        model,
        messages: buildReportMessages(thread, previous, entries),
        schema: { name: "situation_report", zod: ReportAnswer },
        maxCompletionTokens: MAX_COMPLETION_TOKENS,
      };
      if (!(await budget.reserve(lane, estimateTokens(request)))) {
        report.stopped = "budget";
        break;
      }
      if (i > 0) await sleep(pauseMs);

      const result = await client.complete(request);
      if (result.usage) await budget.record({ ...result.usage, model: lane });
      if (!result.ok) {
        report.failed++;
        report.reasons = { ...report.reasons, [result.reason]: (report.reasons?.[result.reason] ?? 0) + 1 };
        if (result.reason === "rate-limited") {
          report.stopped = "rate-limited";
          break;
        }
        continue;
      }

      const settled = settleReport({ answer: result.data, previous, entries, createdAt: now().toISOString(), model });
      if (!settled) {
        report.failed++;
        report.reasons = { ...report.reasons, unsettled: (report.reasons?.unsettled ?? 0) + 1 };
        continue;
      }
      await store.saveReport(thread.id, settled, summarize(settled));
      report.refreshed++;
      report.due--;
      if (settled.rejectedSignals) report.rejectedSignals = (report.rejectedSignals ?? 0) + settled.rejectedSignals;
    }
    return report;
  }

  return {
    async refreshDue(budget) {
      try {
        return await run(budget);
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
