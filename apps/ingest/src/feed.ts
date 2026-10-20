import { XMLParser } from "fast-xml-parser";

// Feeds are untrusted input: bounded in time and size, parsed without DTDs.
export class FeedError extends Error {
  override name = "FeedError";
}

export interface FeedItem {
  title?: string | undefined;
  link?: string | undefined;
  published?: string | undefined;
}

export interface FetchFeedOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

const USER_AGENT = "ForesightBot/0.1 (+https://github.com/SzymekNawrocki/foresight)";

export async function fetchFeed(
  url: string,
  { fetch = globalThis.fetch, timeoutMs = 10_000, maxBytes = 2_000_000 }: FetchFeedOptions = {},
): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new FeedError(`HTTP ${res.status}`);
  if (!res.body) throw new FeedError("Empty body");

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new FeedError(`Feed larger than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  htmlEntities: true,
  isArray: (name) => name === "item",
});

export function parseFeed(xml: string): FeedItem[] {
  // No DTD means no entity expansion ("billion laughs") and no external entities.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new FeedError("DOCTYPE not allowed");

  const doc = parser.parse(xml) as Record<string, unknown>;
  const rss = doc.rss as { channel?: { item?: unknown[] } } | undefined;
  const rdf = doc["rdf:RDF"] as { item?: unknown[] } | undefined;
  if (!rss && !rdf) throw new FeedError("Not an RSS document");

  const items = rss?.channel?.item ?? rdf?.item ?? [];
  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    return {
      title: text(item.title),
      link: text(item.link),
      // The Council of the EU dates its items only with Atom a10:updated.
      published: text(item.pubDate) ?? text(item["dc:date"]) ?? text(item["a10:updated"]),
    };
  });
}

const text = (value: unknown) => (typeof value === "string" ? value : undefined);
