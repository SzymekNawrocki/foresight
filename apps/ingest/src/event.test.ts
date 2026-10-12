import { describe, expect, it } from "vitest";
import { toEvent } from "./event.js";

const fetchedAt = new Date("2026-10-12T18:00:00Z");
const item = {
  title: "  Blast kills teenager,\n injures dozens  ",
  link: "https://www.aljazeera.com/news/2026/10/12/blast?traffic_source=rss#top",
  published: "Mon, 12 Oct 2026 16:44:07 +0000",
};

describe("toEvent", () => {
  it("normalizes an item into a valid Event", () => {
    expect(toEvent(item, "al-jazeera", fetchedAt)).toEqual({
      id: expect.stringMatching(/^[a-f0-9]{32}$/),
      source: "al-jazeera",
      title: "Blast kills teenager, injures dozens",
      url: "https://www.aljazeera.com/news/2026/10/12/blast",
      publishedAt: "2026-10-12T16:44:07.000Z",
      fetchedAt: "2026-10-12T18:00:00.000Z",
    });
  });

  it("gives the same id to the same article reached through different tracking links", () => {
    const a = toEvent(
      { ...item, link: "https://www.bbc.co.uk/news/articles/x1?at_medium=RSS&at_campaign=rss" },
      "bbc-world",
      fetchedAt,
    );
    const b = toEvent({ ...item, link: "https://www.bbc.co.uk/news/articles/x1?utm_source=foo" }, "bbc-world", fetchedAt);

    expect(a?.id).toBeDefined();
    expect(a?.id).toBe(b?.id);
  });

  it("keeps query parameters that identify the article", () => {
    const a = toEvent({ ...item, link: "https://example.com/story?id=1" }, "x", fetchedAt);
    const b = toEvent({ ...item, link: "https://example.com/story?id=2" }, "x", fetchedAt);

    expect(a?.id).not.toBe(b?.id);
  });

  it("falls back to the fetch time when the date is missing or unreadable", () => {
    expect(toEvent({ ...item, published: "yesterday-ish" }, "x", fetchedAt)?.publishedAt).toBe(
      "2026-10-12T18:00:00.000Z",
    );
    expect(toEvent({ ...item, published: undefined }, "x", fetchedAt)?.publishedAt).toBe(
      "2026-10-12T18:00:00.000Z",
    );
  });

  it.each([
    ["a non-https link", { link: "http://example.com/a" }],
    ["a javascript: link", { link: "javascript:alert(1)" }],
    ["a missing link", { link: undefined }],
    ["an empty title", { title: "   " }],
    ["an oversized title", { title: "x".repeat(301) }],
  ])("rejects an item with %s", (_label, patch) => {
    expect(toEvent({ ...item, ...patch }, "x", fetchedAt)).toBeNull();
  });
});
