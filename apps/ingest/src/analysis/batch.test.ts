import type { Event } from "@foresight/shared";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisResult, Analyzer } from "./analyzer.js";
import { analyzeBatch } from "./batch.js";
import { validAnalysis } from "./fixtures.js";

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

const ok: AnalysisResult = { ok: true, analysis: validAnalysis };

const analyzerFrom = (...results: AnalysisResult[]): Analyzer => ({
  analyze: vi.fn(async () => results.shift() ?? ok),
});

const setup = (analyzer: Analyzer, limit = 10) => {
  const saved: string[] = [];
  const sleep = vi.fn(async () => {});
  const run = () =>
    analyzeBatch({
      events,
      analyzer,
      store: { saveAnalysis: async (eventId) => void saved.push(eventId) },
      limit,
      pauseMs: 12_000,
      sleep,
    });
  return { saved, sleep, run };
};

describe("analyzeBatch", () => {
  it("analyzes Events in order and saves each Analysis", async () => {
    const { saved, run } = setup(analyzerFrom());

    await expect(run()).resolves.toEqual({ analyzed: 4, failed: 0, stoppedOnRateLimit: false });
    expect(saved).toEqual(events.map((e) => e.id));
  });

  it("pauses between calls, not after the last one", async () => {
    const { sleep, run } = setup(analyzerFrom());

    await run();
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(12_000);
  });

  it("stops at the limit", async () => {
    const analyzer = analyzerFrom();
    const { saved, run } = setup(analyzer, 2);

    await expect(run()).resolves.toEqual({ analyzed: 2, failed: 0, stoppedOnRateLimit: false });
    expect(saved).toHaveLength(2);
    expect(analyzer.analyze).toHaveBeenCalledTimes(2);
  });

  it("skips a failed Event without saving it and goes on", async () => {
    const { saved, run } = setup(analyzerFrom(ok, { ok: false, reason: "invalid" }));

    await expect(run()).resolves.toEqual({ analyzed: 3, failed: 1, stoppedOnRateLimit: false });
    expect(saved).not.toContain(events[1]?.id);
  });

  it("stops the whole batch on rate limiting", async () => {
    const analyzer = analyzerFrom(ok, { ok: false, reason: "rate-limited" });
    const { saved, run } = setup(analyzer);

    await expect(run()).resolves.toEqual({ analyzed: 1, failed: 1, stoppedOnRateLimit: true });
    expect(saved).toEqual([events[0]?.id]);
    expect(analyzer.analyze).toHaveBeenCalledTimes(2);
  });
});
