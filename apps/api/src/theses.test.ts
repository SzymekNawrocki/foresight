import { type AnalyzedEvent, ConfigResponse, ThesesResponse, Thesis } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { createApi } from "./app.js";
import type { TokenVerifier } from "./auth.js";
import { InMemoryEventReader } from "./events.js";
import { InMemoryThesisStore } from "./theses.js";

const now = new Date("2026-10-16T12:00:00.000Z");
const event: AnalyzedEvent = {
  id: "0123456789abcdef0123456789abcdef",
  source: "al-jazeera",
  title: "Iran threatens to close the Strait of Hormuz",
  url: "https://www.aljazeera.com/news/1",
  publishedAt: "2026-10-16T10:00:00.000Z",
  fetchedAt: "2026-10-16T11:00:00.000Z",
  analysis: {
    regions: ["middle-east"],
    topics: ["energy"],
    weight: 3,
    whyItMatters: "Raz. Dwa.",
    scenario: {
      escalation: { path: "E.", assetClass: "ropa", direction: "up" },
      deescalation: { path: "D.", assetClass: "ropa", direction: "down" },
    },
  },
};

// Tokens are verified by Cognito in production; here two fixed tokens map to two owners.
const verifier: TokenVerifier = { verify: async (token) => ({ "owner-token": "owner", "other-token": "other" })[token] ?? null };

function setup() {
  const theses = new InMemoryThesisStore();
  // The clock moves 1 ms per read, like real time between two requests.
  let t = now.getTime();
  const api = createApi({
    events: new InMemoryEventReader([event]),
    theses,
    auth: { verifier, config: { domain: "https://login.example.com", clientId: "client-1" } },
    now: () => new Date(t++),
  });
  const post = (body: unknown, token = "owner-token") =>
    api.request("/api/theses", {
      method: "POST",
      headers: { "content-type": "application/json", "x-foresight-token": token },
      body: JSON.stringify(body),
    });
  return { api, theses, post };
}

const valid = {
  eventId: event.id,
  instrument: "BNO",
  direction: "up",
  horizonDays: 30,
  rationale: "Ormuz to wąskie gardło, ryzyko podbije Brenta.",
};

describe("GET /api/config", () => {
  it("gives the page the public login settings", async () => {
    const res = await setup().api.request("/api/config");

    expect(ConfigResponse.parse(await res.json())).toEqual({
      auth: { domain: "https://login.example.com", clientId: "client-1" },
    });
  });
});

describe("/api/theses", () => {
  it("rejects requests without a valid token", async () => {
    const { api, post } = setup();

    expect((await api.request("/api/theses")).status).toBe(401);
    expect((await post(valid, "forged")).status).toBe(401);
  });

  it("stores a Thesis with Regions, Topics and dates derived on the server", async () => {
    const { post } = setup();

    const res = await post(valid);

    expect(res.status).toBe(201);
    const thesis = Thesis.parse(await res.json());
    expect(thesis).toMatchObject({
      ...valid,
      eventTitle: event.title,
      regions: ["middle-east"],
      topics: ["energy"],
      createdAt: "2026-10-16T12:00:00.000Z",
      resolveAt: "2026-11-15T12:00:00.000Z",
      status: "open",
    });
  });

  it("ignores fields the owner may not set", async () => {
    const { post } = setup();

    expect((await post({ ...valid, status: "resolved", hit: true })).status).toBe(400);
  });

  it.each([
    ["unknown Instrument", { ...valid, instrument: "BTC" }],
    ["unknown Horizon", { ...valid, horizonDays: 365 }],
    ["too short a rationale", { ...valid, rationale: "bo tak" }],
  ])("rejects %s", async (_, body) => {
    expect((await setup().post(body)).status).toBe(400);
  });

  it("rejects a body that is not JSON", async () => {
    const { api } = setup();
    const res = await api.request("/api/theses", {
      method: "POST",
      headers: { "x-foresight-token": "owner-token" },
      body: "{not json",
    });

    expect(res.status).toBe(400);
  });

  it("answers 404 for an unknown Event", async () => {
    expect((await setup().post({ ...valid, eventId: "f".repeat(32) })).status).toBe(404);
  });

  it("lists only the caller's own Theses, newest first", async () => {
    const { api, post } = setup();
    await post(valid);
    await post({ ...valid, direction: "down" });
    await post(valid, "other-token");

    const res = await api.request("/api/theses", { headers: { "x-foresight-token": "owner-token" } });
    const body = ThesesResponse.parse(await res.json());

    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.theses.map((t) => t.direction)).toEqual(["down", "up"]);
  });
});
