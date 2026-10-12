import type { EventsResponse, HealthResponse } from "@foresight/shared";
import { Hono } from "hono";
import type { EventReader } from "./events.js";

export interface ApiDeps {
  events: EventReader;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** `undefined` → default; a whole number 1..MAX_LIMIT → that number; anything else → null. */
function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!/^\d{1,2}$/.test(raw)) return null;
  const limit = Number(raw);
  return limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

export function createApi({ events }: ApiDeps) {
  return new Hono()
    .basePath("/api")
    .get("/health", (c) => c.json({ status: "ok" } satisfies HealthResponse))
    .get("/events", async (c) => {
      const limit = parseLimit(c.req.query("limit"));
      if (limit === null) return c.json({ error: `limit must be a whole number 1..${MAX_LIMIT}` }, 400);
      return c.json({ events: await events.latest(limit) } satisfies EventsResponse);
    });
}
