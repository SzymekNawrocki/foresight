import type { ConfigResponse, EventsResponse, HealthResponse, MeResponse, RecentResponse } from "@foresight/shared";
import { Hono } from "hono";
import type { AuthConfig, TokenVerifier } from "./auth.js";
import type { EventReader } from "./events.js";

export interface ApiDeps {
  events: EventReader;
  auth?: { verifier: TokenVerifier; config: AuthConfig };
  now?: () => Date;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const RECENT_HOURS = 72;
const RECENT_MAX = 500;
// CloudFront's OAC signs every origin request with its own `Authorization` header, so the
// owner's Cognito access token travels in a header of our own.
export const TOKEN_HEADER = "x-foresight-token";

/** `undefined` → default; a whole number 1..MAX_LIMIT → that number; anything else → null. */
function parseLimit(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!/^\d{1,2}$/.test(raw)) return null;
  const limit = Number(raw);
  return limit >= 1 && limit <= MAX_LIMIT ? limit : null;
}

export function createApi({ events, auth, now = () => new Date() }: ApiDeps) {
  const api = new Hono<{ Variables: { owner: string } }>()
    .basePath("/api")
    .get("/health", (c) => c.json({ status: "ok" } satisfies HealthResponse))
    .get("/config", (c) => c.json({ auth: auth?.config ?? null } satisfies ConfigResponse))
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

  // Owner-only routes (decisions on Threads come in slice 10) need a valid owner token.
  api.use("/me", async (c, next) => {
    const token = c.req.header(TOKEN_HEADER);
    const owner = token && auth ? await auth.verifier.verify(token) : null;
    if (!owner) return c.json({ error: "unauthorized" }, 401);
    c.set("owner", owner);
    c.header("cache-control", "no-store");
    await next();
  });

  api.get("/me", (c) => c.json({ signedIn: true } satisfies MeResponse));

  return api;
}
