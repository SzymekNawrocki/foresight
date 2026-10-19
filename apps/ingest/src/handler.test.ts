import { describe, expect, it, vi } from "vitest";
import type { PendingAnalysis } from "./analysis/pending.js";
import { createTokenBudget, InMemoryBudgetStore } from "./budget/budget.js";
import { createHandler } from "./handler.js";
import { InMemoryEventStore } from "./store.js";

const rss = `<rss><channel>
  <item><title>One</title><link>https://a.example/1</link></item>
  <item><title>Two</title><link>https://a.example/2</link></item>
</channel></rss>`;
const sources = [{ id: "a", name: "A", url: "https://a.example/rss" }];
const limits = { "openai/gpt-oss-20b": 150_000 };

describe("worker handler", () => {
  it("runs the ingest and logs the report as one JSON line", async () => {
    const log = vi.fn();
    const handler = createHandler({ sources, fetchFeed: async () => rss, store: new InMemoryEventStore(), log });

    const report = await handler();

    expect(report).toEqual({ ingest: [{ source: "a", items: 2, new: 2, duplicate: 0, invalid: 0 }], newEvents: 2 });
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
      newEvents: 0,
    });
  });

  it("analyzes pending Events after the ingest and reports the token budget", async () => {
    const store = new InMemoryBudgetStore();
    const seen: string[] = [];
    const pending: PendingAnalysis = {
      async analyzePending(budget) {
        seen.push("analysis");
        await budget.record({ model: "openai/gpt-oss-20b", tokens: 1_234 });
        return { analyzed: 1, failed: 0, backlog: 0 };
      },
    };
    const handler = createHandler({
      sources,
      fetchFeed: async () => {
        seen.push("ingest");
        return rss;
      },
      store: new InMemoryEventStore(),
      log: () => {},
      analysis: { pending, budget: () => createTokenBudget({ store, limits }) },
    });

    const report = await handler();

    expect(seen).toEqual(["ingest", "analysis"]);
    expect(report.analysis).toEqual({ analyzed: 1, failed: 0, backlog: 0 });
    expect(report.tokens).toEqual([{ model: "openai/gpt-oss-20b", used: 1_234, limit: 150_000 }]);
  });

  it("gives every run a fresh budget, so a counter is never stale across warm starts", async () => {
    const budget = vi.fn(() => createTokenBudget({ store: new InMemoryBudgetStore(), limits }));
    const handler = createHandler({
      sources,
      fetchFeed: async () => rss,
      store: new InMemoryEventStore(),
      log: () => {},
      analysis: { pending: { analyzePending: async () => ({ analyzed: 0, failed: 0 }) }, budget },
    });

    await handler();
    await handler();

    expect(budget).toHaveBeenCalledTimes(2);
  });

  it("keeps the ingest result when the budget cannot be read", async () => {
    const handler = createHandler({
      sources,
      fetchFeed: async () => rss,
      store: new InMemoryEventStore(),
      log: () => {},
      analysis: {
        pending: { analyzePending: async () => ({ analyzed: 0, failed: 0 }) },
        budget: () => ({
          reserve: async () => false,
          record: async () => {},
          report: async () => {
            throw new Error("AccessDenied");
          },
        }),
      },
    });

    await expect(handler()).resolves.toEqual({
      ingest: [{ source: "a", items: 2, new: 2, duplicate: 0, invalid: 0 }],
      newEvents: 2,
      analysis: { analyzed: 0, failed: 0 },
      tokens: { error: "AccessDenied" },
    });
  });
});
