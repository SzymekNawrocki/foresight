import type { EventsResponse, HealthResponse, RecentResponse } from "@foresight/shared";
import { Hono } from "hono";
import type { EventReader } from "./events.js";

export interface ApiDeps {
  events: EventReader;
  now?: () => Date;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const RECENT_HOURS = 72;
const RECENT_MAX = 500;

/** `undefined` → default; a whole number 1..MAX_LIMIT → that number; anything else → null. */
function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!/^\d{1,2}$/.test(raw)) return null;
  const limit = Number(raw);
  return limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

export function createApi({ events, now = () => new Date() }: ApiDeps) {
  return new Hono()
    .basePath("/api")
    .get("/health", (c) => c.json({ status: "ok" } satisfies HealthResponse))
    .get("/events", async (c) => {
      const limit = parseLimit(c.req.query("limit"));
      if (limit === null) return c.json({ error: `limit must be a whole number 1..${MAX_LIMIT}` }, 400);
      return c.json({ events: await events.latest(limit) } satisfies EventsResponse);
    })
    .get("/recent", async (c) => {
      // Public data, new Events at most hourly: CloudFront caches it, so DynamoDB reads stay
      // flat no matter how often the page is opened.
      const since = new Date(now().getTime() - RECENT_HOURS * 3_600_000).toISOString();
      c.header("cache-control", "public, max-age=300");
      return c.json({ since, events: await events.since(since, RECENT_MAX) } satisfies RecentResponse);
    });
}
