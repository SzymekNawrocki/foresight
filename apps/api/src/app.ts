import {
  type ConfigResponse,
  type EventsResponse,
  type HealthResponse,
  isDormant,
  type MeResponse,
  ProposalDecision,
  type ProposalsResponse,
  type RecentResponse,
  ThreadId,
  type ThreadResponse,
  type ThreadsResponse,
} from "@foresight/shared";
import { Hono, type MiddlewareHandler } from "hono";
import type { AuthConfig, TokenVerifier } from "./auth.js";
import type { EventReader } from "./events.js";
import type { ThreadDirectory } from "./threads.js";

export interface ApiDeps {
  events: EventReader;
  threads?: ThreadDirectory;
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

export function createApi({ events, threads, auth, now = () => new Date() }: ApiDeps) {
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

  // Owner-only routes need a valid owner token; their answers are never cached.
  const owner: MiddlewareHandler<{ Variables: { owner: string } }> = async (c, next) => {
    const token = c.req.header(TOKEN_HEADER);
    const sub = token && auth ? await auth.verifier.verify(token) : null;
    if (!sub) return c.json({ error: "unauthorized" }, 401);
    c.set("owner", sub);
    c.header("cache-control", "no-store");
    await next();
  };
  api.use("/me", owner);
  api.use("/threads/proposals", owner);
  api.use("/threads/proposals/*", owner);

  api.get("/me", (c) => c.json({ signedIn: true } satisfies MeResponse));

  if (!threads) return api;

  // Proposals first: "/threads/proposals" would otherwise match "/threads/:id".
  api.get("/threads/proposals", async (c) => c.json({ proposals: await threads.proposals() } satisfies ProposalsResponse));

  api.post("/threads/proposals/:id", async (c) => {
    const id = ThreadId.safeParse(c.req.param("id"));
    const decision = ProposalDecision.safeParse(await c.req.json().catch(() => null));
    if (!id.success || !decision.success) return c.json({ error: "bad decision" }, 400);
    const result = await threads.decide(id.data, decision.data);
    if (result === "not-found") return c.json({ error: "no such Thread" }, 404);
    if (result === "conflict") return c.json({ error: "already decided, or the target is not active" }, 409);
    return c.json({ ok: true });
  });

  // Public: active and dormant Threads; proposals, rejected and merged ones stay hidden.
  api.get("/threads", async (c) => {
    const at = now();
    const list = (await threads.list())
      .filter((t) => t.status === "active")
      .toSorted((a, b) => b.lastEventAt.localeCompare(a.lastEventAt))
      .slice(0, 200)
      .map((t) => ({ ...t, dormant: isDormant(t, at) }));
    c.header("cache-control", "public, max-age=60");
    return c.json({ threads: list } satisfies ThreadsResponse);
  });

  api.get("/threads/:id", async (c) => {
    const id = ThreadId.safeParse(c.req.param("id"));
    const view = id.success ? await threads.get(id.data) : null;
    if (!view || view.thread.status !== "active") return c.json({ error: "no such Thread" }, 404);
    c.header("cache-control", "public, max-age=60");
    return c.json({ ...view, thread: { ...view.thread, dormant: isDormant(view.thread, now()) } } satisfies ThreadResponse);
  });

  return api;
}
