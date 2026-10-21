import { ProposalsResponse, type Thread, ThreadResponse, ThreadsResponse, type TimelineEntry } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { createApi } from "./app.js";
import type { TokenVerifier } from "./auth.js";
import { InMemoryEventReader } from "./events.js";
import { InMemoryThreadDirectory } from "./threads.js";

const NOW = new Date("2026-10-21T12:00:00.000Z");
const verifier: TokenVerifier = { verify: async (token) => (token === "owner-token" ? "owner" : null) };

const threadOf = (id: string, overrides: Partial<Thread> = {}): Thread => ({
  id,
  name: `Wątek ${id}`,
  status: "active",
  createdAt: "2026-10-18T10:00:00.000Z",
  lastEventAt: "2026-10-21T09:00:00.000Z",
  eventCount: 1,
  newEvents: 0,
  newWeight: 0,
  regions: ["europe"],
  ...overrides,
});

const entryOf = (letter: string, overrides: Partial<TimelineEntry> = {}): TimelineEntry => ({
  eventId: letter.repeat(32),
  title: `Event ${letter}`,
  url: `https://www.bbc.com/news/${letter}`,
  source: "bbc-world",
  tier: "B",
  publishedAt: "2026-10-21T10:00:00.000Z",
  linkedAt: "2026-10-21T11:00:00.000Z",
  weight: 3,
  whyItMatters: "Ważne.",
  actors: [],
  regions: ["africa"],
  ...overrides,
});

function setup() {
  const directory = new InMemoryThreadDirectory(
    [
      threadOf("aaaa0001"),
      threadOf("aaaa0002", { lastEventAt: "2026-09-01T00:00:00.000Z" }),
      threadOf("bbbb0001", { status: "proposed", name: "Wojna w Sudanie" }),
      threadOf("cccc0001", { status: "rejected" }),
    ],
    { bbbb0001: [entryOf("a")] },
  );
  const api = createApi({
    events: new InMemoryEventReader(),
    threads: directory,
    auth: { verifier, config: { domain: "https://login.example.com", clientId: "c" } },
    now: () => NOW,
  });
  const owner = { "x-foresight-token": "owner-token" };
  const decide = (id: string, body: unknown, headers: Record<string, string> = owner) =>
    api.request(`/api/threads/proposals/${id}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { api, directory, owner, decide };
}

describe("GET /api/threads", () => {
  it("lists active Threads, newest first, marking dormant ones — proposals and closed ones stay hidden", async () => {
    const res = await setup().api.request("/api/threads");

    expect(res.status).toBe(200);
    const body = ThreadsResponse.parse(await res.json());
    expect(body.threads.map((t) => [t.id, t.dormant])).toEqual([
      ["aaaa0001", false],
      ["aaaa0002", true],
    ]);
  });
});

describe("GET /api/threads/:id", () => {
  it("returns the Thread with its report and timeline", async () => {
    const res = await setup().api.request("/api/threads/aaaa0001");

    expect(ThreadResponse.parse(await res.json())).toMatchObject({ thread: { id: "aaaa0001" }, report: null, timeline: [] });
  });

  it("answers 404 for a proposal, a closed Thread or a malformed id", async () => {
    const { api } = setup();

    for (const id of ["bbbb0001", "cccc0001", "nope", "../x"]) {
      expect((await api.request(`/api/threads/${id}`)).status).toBe(404);
    }
  });
});

describe("owner decisions on New situations", () => {
  it("needs the owner token for the inbox and every decision", async () => {
    const { api, decide } = setup();

    expect((await api.request("/api/threads/proposals")).status).toBe(401);
    expect((await decide("bbbb0001", { action: "accept" }, { "x-foresight-token": "forged" })).status).toBe(401);
  });

  it("shows proposals with their timeline, uncached", async () => {
    const { api, owner } = setup();

    const res = await api.request("/api/threads/proposals", { headers: owner });

    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(ProposalsResponse.parse(await res.json()).proposals).toEqual([
      { thread: expect.objectContaining({ id: "bbbb0001" }), timeline: [entryOf("a")] },
    ]);
  });

  it("accepts a proposal, optionally under a new name, and only once", async () => {
    const { directory, decide } = setup();

    expect((await decide("bbbb0001", { action: "accept", name: "Sudan" })).status).toBe(200);
    expect(directory.threads.get("bbbb0001")).toMatchObject({ status: "active", name: "Sudan" });
    expect((await decide("bbbb0001", { action: "reject" })).status).toBe(409);
  });

  it("merges a proposal into an active Thread, moving its timeline", async () => {
    const { directory, decide } = setup();

    expect((await decide("bbbb0001", { action: "merge", into: "aaaa0001" })).status).toBe(200);
    expect(directory.threads.get("bbbb0001")).toMatchObject({ status: "merged", mergedInto: "aaaa0001" });
    expect(directory.entries.aaaa0001).toEqual([entryOf("a")]);
    expect(directory.threads.get("aaaa0001")).toMatchObject({ eventCount: 2, newEvents: 1, newWeight: 3, regions: ["europe", "africa"] });
  });

  it("refuses a merge into a Thread that is not active, and malformed decisions", async () => {
    const { decide } = setup();

    expect((await decide("bbbb0001", { action: "merge", into: "cccc0001" })).status).toBe(409);
    expect((await decide("bbbb0001", { action: "merge", into: "ffff0001" })).status).toBe(404);
    expect((await decide("bbbb0001", { action: "delete" })).status).toBe(400);
    expect((await decide("bbbb0001", { action: "accept", extra: true })).status).toBe(400);
    expect((await decide("etc-0001", { action: "accept" })).status).toBe(400);
  });
});
