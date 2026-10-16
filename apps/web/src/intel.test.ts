import type { AnalyzedEvent } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { briefing, regionOfCountry } from "./intel.js";

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
      weight,
      whyItMatters: "Raz. Dwa.",
      scenario: {
        escalation: { path: "E.", assetClass: "ropa", direction: "up" },
        deescalation: { path: "D.", assetClass: "ropa", direction: "down" },
      },
    },
  }) as AnalyzedEvent;

describe("briefing", () => {
  const events: AnalyzedEvent[] = [
    analyzed("a", 1, 3, ["europe", "russia-eurasia"], ["battlefield"]),
    analyzed("b", 2, 2, ["europe"], ["energy"]),
    analyzed("c", 3, 1, ["europe"], ["energy"]),
    analyzed("d", 30, 3, ["middle-east"], ["energy"]),
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

  it("counts Topics the same way", () => {
    expect(briefing(events, now).topics).toMatchObject({ battlefield: 1, energy: 1, ai: 1, cyber: 0 });
  });

  it("sums up the last 24 h", () => {
    expect(briefing(events, now).totals).toEqual({ events: 5, significant: 3, breakthrough: 1, pending: 1 });
  });

  it("puts the heaviest recent Events first", () => {
    expect(briefing(events, now).top.map((e) => e.id[0])).toEqual(["a", "b", "e"]);
  });
});
