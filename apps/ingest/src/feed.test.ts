import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FeedError, fetchFeed, parseFeed } from "./feed.js";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.xml`, import.meta.url), "utf8");

describe("parseFeed", () => {
  it.each(["bbc-world", "al-jazeera", "cnbc-world", "notes-from-poland"])(
    "reads title, link and date of every item in %s",
    (name) => {
      const items = parseFeed(fixture(name));

      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item.title).toBeTruthy();
        expect(item.link).toMatch(/^https:\/\//);
        expect(item.published).toBeTruthy();
      }
    },
  );

  it("decodes CDATA and entities in titles", () => {
    expect(parseFeed(fixture("bbc-world"))[0]?.title).toBe(
      "Six Ukrainian energy sites hit by Russia since Trump announced ceasefire, Zelensky says",
    );
    expect(parseFeed(fixture("cnbc-world"))[0]?.title).toBe(
      "Trump defends Russia diesel deal after bipartisan pushback: 'I made the right choice'",
    );
  });

  it("reads RDF (RSS 1.0) feeds with dc:date", () => {
    const xml = `<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <item><title>One</title><link>https://example.com/1</link><dc:date>2026-10-12T10:00:00Z</dc:date></item>
      </rdf:RDF>`;

    expect(parseFeed(xml)).toEqual([
      { title: "One", link: "https://example.com/1", published: "2026-10-12T10:00:00Z" },
    ]);
  });

  it("rejects documents with a DOCTYPE (entity expansion attacks)", () => {
    const xml = `<?xml version="1.0"?><!DOCTYPE lol [<!ENTITY a "aaaa">]><rss><channel><item><title>&a;</title></item></channel></rss>`;

    expect(() => parseFeed(xml)).toThrow(FeedError);
  });

  it("rejects documents that are not RSS", () => {
    expect(() => parseFeed("<html><body>Hi</body></html>")).toThrow(FeedError);
  });
});

describe("fetchFeed", () => {
  const respond = (body: string, init?: ResponseInit) => async () => new Response(body, init);

  it("returns the body of a successful response", async () => {
    await expect(fetchFeed("https://example.com/rss", { fetch: respond("<rss/>") })).resolves.toBe("<rss/>");
  });

  it("fails on a non-2xx status", async () => {
    await expect(
      fetchFeed("https://example.com/rss", { fetch: respond("nope", { status: 503 }) }),
    ).rejects.toThrow("HTTP 503");
  });

  it("stops reading once the body exceeds the size cap", async () => {
    await expect(
      fetchFeed("https://example.com/rss", { fetch: respond("x".repeat(2000)), maxBytes: 1000 }),
    ).rejects.toThrow(FeedError);
  });

  it("gives up after the timeout", async () => {
    const hang = (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    await expect(fetchFeed("https://example.com/rss", { fetch: hang, timeoutMs: 20 })).rejects.toThrow();
  });
});
