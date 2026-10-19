import type { Analysis, Event } from "@foresight/shared";
import { describe, expect, it, vi } from "vitest";
import { createTokenBudget, InMemoryBudgetStore } from "../budget/budget.js";
import { createFakeLlm, type FakeReply } from "../llm/fake.js";
import { validAnalysis } from "./fixtures.js";
import { createPendingAnalysis } from "./pending.js";
import { buildMessages } from "./prompt.js";
import type { AnalysisQueue } from "./queue.js";

const MODEL = "openai/gpt-oss-20b";

const events = ["a", "b", "c", "d"].map(
  (letter): Event => ({
    id: letter.repeat(32),
    source: "bbc-world",
    title: `Event ${letter}`,
    url: `https://www.bbc.com/news/${letter}`,
    publishedAt: "2026-10-16T10:00:00.000Z",
    fetchedAt: "2026-10-16T11:00:00.000Z",
  }),
);

const ok: FakeReply = { answer: validAnalysis };

function queueOf(pending: Event[]) {
  const saved = new Map<string, Analysis>();
  const queue: AnalysisQueue = {
    pending: async (limit) => pending.filter((e) => !saved.has(e.id)).slice(0, limit),
    saveAnalysis: async (eventId, analysis) => void saved.set(eventId, analysis),
    backlog: async () => pending.filter((e) => !saved.has(e.id)).length,
  };
  return { queue, saved };
}

function setup({ replies = [ok, ok, ok, ok], pending = events, limit = 10, tokenLimit = 1_000_000 } = {}) {
  const { queue, saved } = queueOf(pending);
  const llm = createFakeLlm(replies);
  const openLlm = vi.fn(async () => llm);
  const sleep = vi.fn(async () => {});
  const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits: { [MODEL]: tokenLimit } });
  const analysis = createPendingAnalysis({ queue, llm: openLlm, limit, pauseMs: 12_000, sleep });
  return { analysis, budget, llm, openLlm, saved, sleep };
}

describe("analyzePending", () => {
  it("analyzes the pending Events one by one with gpt-oss-20b and saves each Analysis", async () => {
    const { analysis, budget, llm, saved } = setup();

    await expect(analysis.analyzePending(budget)).resolves.toEqual({ analyzed: 4, failed: 0, backlog: 0 });
    expect([...saved.keys()]).toEqual(events.map((e) => e.id));
    expect(llm.requests.map((r) => r.model)).toEqual(Array(4).fill(MODEL));
    expect(llm.requests[0]?.messages).toEqual(buildMessages(events[0] as Event));
  });

  it("counts the tokens of every answered call in the budget", async () => {
    const { analysis, budget } = setup({ replies: [ok, { answer: { weight: 9 } }, ok, ok] });

    await analysis.analyzePending(budget);

    await expect(budget.report()).resolves.toEqual([{ model: MODEL, used: 4_000, limit: 1_000_000 }]);
  });

  it("pauses between calls, not after the last one", async () => {
    const { analysis, budget, sleep } = setup();

    await analysis.analyzePending(budget);

    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(12_000);
  });

  it("stops at the per-run limit and reports what is left", async () => {
    const { analysis, budget, llm } = setup({ limit: 2 });

    await expect(analysis.analyzePending(budget)).resolves.toEqual({ analyzed: 2, failed: 0, backlog: 2 });
    expect(llm.requests).toHaveLength(2);
  });

  it("skips an invalid answer without saving it and goes on", async () => {
    const { analysis, budget, saved } = setup({ replies: [ok, { answer: { weight: 9 } }, ok, ok] });

    await expect(analysis.analyzePending(budget)).resolves.toEqual({ analyzed: 3, failed: 1, backlog: 1 });
    expect(saved.has(events[1]?.id as string)).toBe(false);
  });

  it("stops the run on rate limiting", async () => {
    const { analysis, budget, llm } = setup({ replies: [ok, { fail: "rate-limited" }] });

    await expect(analysis.analyzePending(budget)).resolves.toEqual({
      analyzed: 1,
      failed: 1,
      stopped: "rate-limited",
      backlog: 3,
    });
    expect(llm.requests).toHaveLength(2);
  });

  it("stops before a call that would cross the daily token budget", async () => {
    // Each request is estimated at a few thousand tokens; 1 000 fits none.
    const { analysis, budget, llm } = setup({ tokenLimit: 1_000 });

    await expect(analysis.analyzePending(budget)).resolves.toEqual({
      analyzed: 0,
      failed: 0,
      stopped: "budget",
      backlog: 4,
    });
    expect(llm.requests).toHaveLength(0);
  });

  it("does not open the LLM (or read its key) when nothing is pending", async () => {
    const { analysis, budget, openLlm } = setup({ pending: [] });

    await expect(analysis.analyzePending(budget)).resolves.toEqual({ analyzed: 0, failed: 0, backlog: 0 });
    expect(openLlm).not.toHaveBeenCalled();
  });

  it("reports a failure to open the LLM (e.g. key unreadable) instead of throwing", async () => {
    const { analysis, budget, openLlm } = setup();
    openLlm.mockRejectedValueOnce(new Error("AccessDenied"));

    await expect(analysis.analyzePending(budget)).resolves.toEqual({ error: "AccessDenied", backlog: 4 });
  });
});
