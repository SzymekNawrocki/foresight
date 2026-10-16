import {
  type ConfigResponse,
  type EventsResponse,
  type HealthResponse,
  NewThesis,
  type RecentResponse,
  type ThesesResponse,
  type Thesis,
} from "@foresight/shared";
import { Hono } from "hono";
import type { AuthConfig, TokenVerifier } from "./auth.js";
import type { EventReader } from "./events.js";
import type { ThesisStore } from "./theses.js";

export interface ApiDeps {
  events: EventReader;
  theses?: ThesisStore;
  auth?: { verifier: TokenVerifier; config: AuthConfig };
  now?: () => Date;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const RECENT_HOURS = 72;
const RECENT_MAX = 500;
const DAY_MS = 86_400_000;
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

const randomHex = () => crypto.getRandomValues(new Uint8Array(4)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

export function createApi({ events, theses, auth, now = () => new Date() }: ApiDeps) {
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

  // Theses are private: every route below needs a valid owner token, and an owner only ever
  // reads and writes under their own id.
  api.use("/theses", async (c, next) => {
    const token = c.req.header(TOKEN_HEADER);
    const owner = token && auth ? await auth.verifier.verify(token) : null;
    if (!owner || !theses) return c.json({ error: "unauthorized" }, 401);
    c.set("owner", owner);
    c.header("cache-control", "no-store");
    await next();
  });

  api.get("/theses", async (c) => {
    return c.json({ theses: await (theses as ThesisStore).list(c.get("owner")) } satisfies ThesesResponse);
  });

  api.post("/theses", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = NewThesis.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid Thesis" }, 400);

    const event = await events.get(parsed.data.eventId);
    if (!event) return c.json({ error: "unknown Event" }, 404);

    const created = now();
    const thesis: Thesis = {
      ...parsed.data,
      id: `${created.toISOString()}#${randomHex()}`,
      eventTitle: event.title,
      regions: event.analysis?.regions ?? [],
      topics: event.analysis?.topics ?? [],
      createdAt: created.toISOString(),
      resolveAt: new Date(created.getTime() + parsed.data.horizonDays * DAY_MS).toISOString(),
      status: "open",
    };
    await (theses as ThesisStore).put(c.get("owner"), thesis);
    return c.json(thesis, 201);
  });

  return api;
}
