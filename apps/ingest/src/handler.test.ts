import { describe, expect, it, vi } from "vitest";
import { createHandler } from "./handler.js";
import { InMemoryEventStore } from "./store.js";

const rss = `<rss><channel><item><title>One</title><link>https://a.example/1</link></item></channel></rss>`;

describe("ingest handler", () => {
  it("runs the ingest and logs the report as one JSON line", async () => {
    const log = vi.fn();
    const handler = createHandler({
      sources: [{ id: "a", name: "A", url: "https://a.example/rss" }],
      fetchFeed: async () => rss,
      store: new InMemoryEventStore(),
      log,
    });

    const report = await handler();

    expect(report).toEqual([{ source: "a", items: 1, new: 1, duplicate: 0, invalid: 0 }]);
    expect(JSON.parse(log.mock.calls[0]?.[0])).toEqual({ msg: "ingest finished", report });
  });

  it("does not throw when every Source fails — the next hourly run tries again", async () => {
    const handler = createHandler({
      sources: [{ id: "a", name: "A", url: "https://a.example/rss" }],
      fetchFeed: async () => {
        throw new Error("HTTP 503");
      },
      store: new InMemoryEventStore(),
      log: () => {},
    });

    await expect(handler()).resolves.toEqual([
      { source: "a", items: 0, new: 0, duplicate: 0, invalid: 0, error: "HTTP 503" },
    ]);
  });
});
