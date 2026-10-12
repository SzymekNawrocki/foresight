import { createHash } from "node:crypto";
import { Event } from "@foresight/shared";
import type { FeedItem } from "./feed.js";

// Query parameters that only track where a click came from — not part of the article's identity.
const TRACKING_PARAM = /^(utm_|at_)|^traffic_source$/;

export function toEvent(item: FeedItem, source: string, fetchedAt: Date): Event | null {
  const url = canonicalUrl(item.link);
  if (!url) return null;

  const published = item.published ? new Date(item.published) : undefined;
  const result = Event.safeParse({
    id: createHash("sha256").update(url).digest("hex").slice(0, 32),
    source,
    title: item.title?.replace(/\s+/g, " ").trim(),
    url,
    publishedAt: (published && !Number.isNaN(published.getTime()) ? published : fetchedAt).toISOString(),
    fetchedAt: fetchedAt.toISOString(),
  });
  return result.success ? result.data : null;
}

function canonicalUrl(link: string | undefined): string | null {
  if (!link || !URL.canParse(link.trim())) return null;

  const url = new URL(link.trim());
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}
