import { describe, expect, it, vi } from "vitest";
import { validAnalysis } from "./analysis/fixtures.js";
import { createHandler } from "./handler.js";
import { InMemoryEventStore } from "./store.js";

const rss = `<rss><channel><item><title>One</title><link>https://a.example/1</link></item></channel></rss>`;
const sources = [{ id: "a", name: "A", url: "https://a.example/rss" }];

describe("ingest handler", () => {
  it("runs the ingest and logs the report as one JSON line", async () => {
    const log = vi.fn();
    const handler = createHandler({ sources, fetchFeed: async () => rss, store: new InMemoryEventStore(), log });

    const report = await handler();

    expect(report).toEqual({ ingest: [{ source: "a", items: 1, new: 1, duplicate: 0, invalid: 0 }] });
    expect(JSON.parse(log.mock.calls[0]?.[0])).toEqual({ msg: "ingest finished", report });
  });

  it("does not throw when every Source fails — the next hourly run tries again", async () => {
    const handler = createHandler({
      sources,
      fetchFeed: async () => {
        throw new Error("HTTP 503");
      },
      store: new InMemoryEventStore(),
      log: () => {},
    });

    await expect(handler()).resolves.toEqual({
      ingest: [{ source: "a", items: 0, new: 0, duplicate: 0, invalid: 0, error: "HTTP 503" }],
    });
  });

  it("analyzes pending Events after the ingest", async () => {
    const store = new InMemoryEventStore();
    const saved: string[] = [];
    const handler = createHandler({
      sources,
      fetchFeed: async () => rss,
      store,
      log: () => {},
      analysis: {
        queue: {
          pending: async (limit) => store.latest(limit),
          saveAnalysis: async (eventId) => void saved.push(eventId),
        },
        analyzer: async () => ({ analyze: async () => ({ ok: true, analysis: validAnalysis }) }),
        pauseMs: 0,
      },
    });

    const report = await handler();

    expect(report.analysis).toEqual({ analyzed: 1, failed: 0, stoppedOnRateLimit: false });
    expect(saved).toHaveLength(1);
  });

  it("does not read the key when nothing is pending", async () => {
    const analyzer = vi.fn();
    const handler = createHandler({
      sources,
      fetchFeed: async () => rss,
      store: new InMemoryEventStore(),
      log: () => {},
      analysis: { queue: { pending: async () => [], saveAnalysis: async () => {} }, analyzer },
    });

    const report = await handler();

    expect(report.analysis).toEqual({ analyzed: 0, failed: 0, stoppedOnRateLimit: false });
    expect(analyzer).not.toHaveBeenCalled();
  });

  it("keeps the ingest result when the Analysis step fails (e.g. key unreadable)", async () => {
    const store = new InMemoryEventStore();
    const handler = createHandler({
      sources,
      fetchFeed: async () => rss,
      store,
      log: () => {},
      analysis: {
        queue: { pending: async (limit) => store.latest(limit), saveAnalysis: async () => {} },
        analyzer: async () => {
          throw new Error("AccessDenied");
        },
      },
    });

    await expect(handler()).resolves.toEqual({
      ingest: [{ source: "a", items: 1, new: 1, duplicate: 0, invalid: 0 }],
      analysis: { error: "AccessDenied" },
    });
  });
});
