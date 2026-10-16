import { type Event, EventsResponse, HealthResponse, RecentResponse } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { createApi } from "./app.js";
import { InMemoryEventReader } from "./events.js";

function event(n: number, publishedAt: string): Event {
  return {
    id: n.toString(16).padStart(32, "0"),
    source: "bbc-world",
    title: `Event ${n}`,
    url: `https://example.com/${n}`,
    publishedAt,
    fetchedAt: "2026-10-12T12:00:00.000Z",
  };
}

const older = event(1, "2026-10-12T08:00:00.000Z");
const newer = event(2, "2026-10-12T10:00:00.000Z");

function api(events: Event[] = []) {
  return createApi({ events: new InMemoryEventReader(events) });
}

describe("GET /api/health", () => {
  it("responds 200 with a body matching the shared HealthResponse contract", async () => {
    const res = await api().request("/api/health");

    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: "ok" });
  });

  it("responds 404 for unknown API routes", async () => {
    const res = await api().request("/api/nope");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/events", () => {
  it("returns Events newest first, matching the shared EventsResponse contract", async () => {
    const res = await api([older, newer]).request("/api/events");

    expect(res.status).toBe(200);
    expect(EventsResponse.parse(await res.json())).toEqual({ events: [newer, older] });
  });

  it("returns an empty list when there are no Events", async () => {
    const res = await api().request("/api/events");

    expect(await res.json()).toEqual({ events: [] });
  });

  it("returns at most 20 Events by default", async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      event(i + 1, new Date(Date.UTC(2026, 9, 12, 0, i)).toISOString()),
    );

    const body = EventsResponse.parse(await (await api(many).request("/api/events")).json());

    expect(body.events).toHaveLength(20);
  });

  it("honours ?limit within 1..50", async () => {
    const body = EventsResponse.parse(
      await (await api([older, newer]).request("/api/events?limit=1")).json(),
    );

    expect(body.events).toEqual([newer]);
  });

  it.each(["0", "51", "999", "-1", "1.5", "abc", ""])("rejects ?limit=%s with 400", async (limit) => {
    const res = await api().request(`/api/events?limit=${limit}`);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/recent", () => {
  const now = new Date("2026-10-12T12:00:00.000Z");
  const recentApi = (events: Event[]) => createApi({ events: new InMemoryEventReader(events), now: () => now });

  it("returns the Events of the last 72 hours, newest first", async () => {
    const tooOld = event(3, "2026-10-09T11:59:59.000Z");
    const res = await recentApi([older, tooOld, newer]).request("/api/recent");

    expect(res.status).toBe(200);
    expect(RecentResponse.parse(await res.json())).toEqual({
      since: "2026-10-09T12:00:00.000Z",
      events: [newer, older],
    });
  });

  it("lets browsers and CloudFront cache it for a few minutes", async () => {
    const res = await recentApi([]).request("/api/recent");

    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });
});
