import { describe, expect, it } from "vitest";
import { runIngest } from "./ingest.js";
import type { SourceTier } from "./sources.js";
import { type EventStore, InMemoryEventStore } from "./store.js";

const rss = (...links: string[]) =>
  `<rss><channel>${links
    .map(
      (link, i) =>
        `<item><title>Item ${i}</title><link>${link}</link><pubDate>Mon, 12 Oct 2026 10:00:00 GMT</pubDate></item>`,
    )
    .join("")}</channel></rss>`;

const now = () => new Date("2026-10-12T18:00:00Z");

describe("runIngest", () => {
  it("stores new Events and reports per Source", async () => {
    const store = new InMemoryEventStore();
    const report = await runIngest({
      sources: [{ id: "a", name: "A", tier: "B", url: "https://a.example/rss" }],
      fetchFeed: async () => rss("https://a.example/1", "https://a.example/2", "http://insecure.example/3"),
      store,
      now,
    });

    expect(report).toEqual([{ source: "a", items: 3, new: 2, duplicate: 0, invalid: 1, stale: 0 }]);
    expect(store.size).toBe(2);
  });

  it("does not store the same article twice across runs", async () => {
    const store = new InMemoryEventStore();
    const input = {
      sources: [{ id: "a", name: "A", tier: "B" as const, url: "https://a.example/rss" }],
      fetchFeed: async () => rss("https://a.example/1"),
      store,
      now,
    };

    await runIngest(input);
    const second = await runIngest(input);

    expect(second).toEqual([{ source: "a", items: 1, new: 0, duplicate: 1, invalid: 0, stale: 0 }]);
    expect(store.size).toBe(1);
  });

  it("keeps going when one Source fails", async () => {
    const store = new InMemoryEventStore();
    const report = await runIngest({
      sources: [
        { id: "down", name: "Down", tier: "B", url: "https://down.example/rss" },
        { id: "up", name: "Up", tier: "B", url: "https://up.example/rss" },
      ],
      fetchFeed: async (url) => {
        if (url.includes("down")) throw new Error("HTTP 503");
        return rss("https://up.example/1");
      },
      store,
      now,
    });

    expect(report).toEqual([
      { source: "down", items: 0, new: 0, duplicate: 0, invalid: 0, stale: 0, error: "HTTP 503" },
      { source: "up", items: 1, new: 1, duplicate: 0, invalid: 0, stale: 0 },
    ]);
  });

  it("marks each new Event with the tier of its Source, so the queue can take tier A first", async () => {
    const tiers: SourceTier[] = [];
    const store: EventStore = {
      putIfAbsent: async (_event, tier) => {
        tiers.push(tier);
        return true;
      },
    };
    await runIngest({
      sources: [{ id: "gov", name: "Gov", tier: "A", url: "https://gov.example/rss" }],
      fetchFeed: async () => rss("https://gov.example/1"),
      store,
      now,
    });

    expect(tiers).toEqual(["A"]);
  });

  it("skips items published more than 48 h before the run (a new feed starts with its fresh items only)", async () => {
    const store = new InMemoryEventStore();
    const report = await runIngest({
      sources: [{ id: "a", name: "A", tier: "A", url: "https://a.example/rss" }],
      fetchFeed: async () => rss("https://a.example/1"),
      store,
      now: () => new Date("2026-10-14T10:00:01Z"),
    });

    expect(report).toEqual([{ source: "a", items: 1, new: 0, duplicate: 0, invalid: 0, stale: 1 }]);
    expect(store.size).toBe(0);
  });
});
