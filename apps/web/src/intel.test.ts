import type { AnalyzedEvent, ThreadsResponse } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { briefing, freshness, regionOfCountry, threadGrid } from "./intel.js";

describe("threadGrid", () => {
  const listed = (id: string, lastEventAt: string, newEvents: number, dormant = false): ThreadsResponse["threads"][number] => ({
    id,
    name: id,
    status: "active",
    createdAt: "2026-10-01T00:00:00.000Z",
    lastEventAt,
    eventCount: 3,
    newEvents,
    newWeight: newEvents ? 2 : 0,
    regions: [],
    dormant,
  });

  it("puts Threads with new Events since their Report first, then the latest Event", () => {
    const grid = threadGrid([
      listed("aaaa0001", "2026-10-28T10:00:00.000Z", 0),
      listed("aaaa0002", "2026-10-27T10:00:00.000Z", 2),
      listed("aaaa0003", "2026-10-28T11:00:00.000Z", 0),
      listed("aaaa0004", "2026-10-26T10:00:00.000Z", 1),
    ]);

    expect(grid.active.map((t) => t.id)).toEqual(["aaaa0002", "aaaa0004", "aaaa0003", "aaaa0001"]);
  });

  it("keeps dormant Threads apart, latest Event first", () => {
    const grid = threadGrid([
      listed("aaaa0001", "2026-09-01T00:00:00.000Z", 0, true),
      listed("aaaa0002", "2026-10-28T00:00:00.000Z", 0),
      listed("aaaa0003", "2026-09-20T00:00:00.000Z", 0, true),
    ]);

    expect(grid.active.map((t) => t.id)).toEqual(["aaaa0002"]);
    expect(grid.dormant.map((t) => t.id)).toEqual(["aaaa0003", "aaaa0001"]);
  });
});

describe("regionOfCountry", () => {
  it.each([
    ["United States of America", [-98, 39], "north-america"],
    ["Mexico", [-102.2, 23.9], "latin-america"],
    ["Brazil", [-53, -10], "latin-america"],
    ["Ukraine", [31.3, 49.2], "europe"],
    ["Iceland", [-18, 65], "europe"],
    ["Russia", [95.8, 66.1], "russia-eurasia"],
    ["Georgia", [43.5, 42.2], "russia-eurasia"],
    ["Kazakhstan", [67.2, 48.4], "russia-eurasia"],
    ["Turkey", [35.1, 39.1], "middle-east"],
    ["Egypt", [29.9, 26.5], "middle-east"],
    ["Iran", [54, 32], "middle-east"],
    ["Eritrea", [38.7, 15.4], "africa"],
    ["Sudan", [29.8, 16], "africa"],
    ["Nigeria", [8, 9.5], "africa"],
    ["India", [79, 22], "asia-pacific"],
    ["Australia", [134, -25], "asia-pacific"],
    ["Fiji", [178.6, -17.3], "asia-pacific"],
  ] as const)("%s → %s", (name, centroid, region) => {
    expect(regionOfCountry(name, [...centroid])).toBe(region);
  });

  it("leaves Antarctica out of every Region", () => {
    expect(regionOfCountry("Antarctica", [82.5, -85])).toBeNull();
  });
});

const now = new Date("2026-10-16T12:00:00.000Z");
const analyzed = (id: string, hoursAgo: number, weight: number, regions: string[], topics: string[] = []) =>
  ({
    id: id.repeat(32),
    source: "bbc-world",
    title: `Event ${id}`,
    url: "https://example.com/",
    publishedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    fetchedAt: now.toISOString(),
    analysis: {
      regions,
      topics,
      actors: [],
      weight,
      whyItMatters: "Raz.",
      thread: { kind: "none" },
    },
  }) as AnalyzedEvent;

describe("briefing", () => {
  const events: AnalyzedEvent[] = [
    analyzed("a", 1, 3, ["europe", "russia-eurasia"], ["drones"]),
    analyzed("b", 2, 2, ["europe"], ["chips", "energy"]),
    analyzed("c", 3, 1, ["europe"], ["chips"]),
    analyzed("d", 30, 3, ["middle-east"], ["chips"]),
    analyzed("e", 5, 2, ["global"], ["ai"]),
    { ...analyzed("f", 1, 1, []), analysis: undefined },
  ];

  it("counts Events with Weight ≥ 2 from the last 24 h per Region", () => {
    expect(briefing(events, now).regions).toEqual({
      "north-america": 0,
      "latin-america": 0,
      europe: 2,
      "russia-eurasia": 1,
      "middle-east": 0,
      africa: 0,
      "asia-pacific": 0,
      global: 1,
    });
  });

  it("counts the Niche Topics the same way, skipping an old Topic still on an Event", () => {
    expect(briefing(events, now).topics).toEqual({ cyber: 0, drones: 1, space: 0, chips: 1, ai: 1, "defence-industry": 0 });
  });

  it("sums up the last 24 h", () => {
    expect(briefing(events, now).totals).toEqual({ events: 5, significant: 3, breakthrough: 1, pending: 1 });
  });

  it("puts the heaviest recent Events first", () => {
    expect(briefing(events, now).top.map((e) => e.id[0])).toEqual(["a", "b", "e"]);
  });
});

describe("freshness", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const fetched = (iso: string) => ({ ...base, fetchedAt: iso });
  const base: AnalyzedEvent = {
    id: "0123456789abcdef0123456789abcdef",
    source: "bbc-world",
    title: "T",
    url: "https://www.bbc.co.uk/news/1",
    publishedAt: "2026-10-19T09:00:00Z",
    fetchedAt: "2026-10-19T09:00:00Z",
  };

  it("reads the newest fetch time, not the publication time", () => {
    expect(freshness([fetched("2026-10-19T10:00:00Z"), fetched("2026-10-19T11:48:00Z")], now)).toEqual({
      text: "ostatnie Zdarzenie: 12 min temu",
      stale: false,
    });
  });

  it("switches to hours and marks data older than 2 h as stale", () => {
    expect(freshness([fetched("2026-10-19T08:30:00Z")], now)).toEqual({ text: "ostatnie Zdarzenie: 3 h temu", stale: true });
  });

  it("says 'przed chwilą' under a minute", () => {
    expect(freshness([fetched("2026-10-19T11:59:40Z")], now)?.text).toBe("ostatnie Zdarzenie: przed chwilą");
  });

  it("has nothing to say without Events", () => {
    expect(freshness([], now)).toBeNull();
  });
});
