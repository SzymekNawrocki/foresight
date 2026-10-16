import type { Thesis } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { type DailyClose, firstCloseAfter, judge, planResolution } from "./resolve.js";

const thesis = (over: Partial<Thesis> = {}): Thesis => ({
  id: "2026-10-16T12:00:00.000Z#0a1b2c3d",
  eventId: "0123456789abcdef0123456789abcdef",
  eventTitle: "Title",
  instrument: "BNO",
  direction: "up",
  horizonDays: 7,
  rationale: "Uzasadnienie dłuższe niż dziesięć znaków.",
  regions: ["middle-east"],
  topics: ["energy"],
  createdAt: "2026-10-16T12:00:00.000Z",
  resolveAt: "2026-10-23T12:00:00.000Z",
  status: "open",
  ...over,
});

const closes: DailyClose[] = [
  { date: "2026-10-15", close: 99 },
  { date: "2026-10-16", close: 100 },
  { date: "2026-10-19", close: 101 },
  { date: "2026-10-23", close: 103 },
];

describe("firstCloseAfter", () => {
  it("takes the same day's close when the Thesis came before the US close", () => {
    expect(firstCloseAfter(closes, "2026-10-16T12:00:00.000Z")).toEqual({ date: "2026-10-16", close: 100 });
  });

  it("takes the next trading day when the Thesis came after the close (no peeking)", () => {
    expect(firstCloseAfter(closes, "2026-10-16T20:30:00.000Z")).toEqual({ date: "2026-10-19", close: 101 });
  });

  it("returns null while the price is not published yet", () => {
    expect(firstCloseAfter(closes, "2026-10-24T09:00:00.000Z")).toBeNull();
  });
});

describe("judge", () => {
  it.each([
    [100, 102.5, "up"],
    [100, 97.5, "down"],
    [100, 102, "flat"],
    [100, 98, "flat"],
  ] as const)("%d → %d is %s (a move within 2 percent is no change)", (entry, exit, actual) => {
    expect(judge(entry, exit)).toBe(actual);
  });
});

describe("planResolution", () => {
  const now = new Date("2026-10-24T06:00:00.000Z");

  it("fills in the entry price of a new Thesis", () => {
    expect(planResolution(thesis({ resolveAt: "2026-11-15T12:00:00.000Z" }), closes, now)).toEqual({ entryPrice: 100 });
  });

  it("resolves a Thesis whose Horizon has passed", () => {
    expect(planResolution(thesis(), closes, now)).toEqual({
      entryPrice: 100,
      exitPrice: 103,
      actual: "up",
      hit: true,
      status: "resolved",
      resolvedAt: now.toISOString(),
    });
  });

  it("marks a wrong Direction as a miss", () => {
    expect(planResolution(thesis({ direction: "down" }), closes, now)).toMatchObject({ actual: "up", hit: false });
  });

  it("waits when a price is missing", () => {
    expect(planResolution(thesis(), [], now)).toBeNull();
    expect(planResolution(thesis({ entryPrice: 100 }), closes.slice(0, 3), now)).toBeNull();
  });

  it("leaves an already resolved Thesis alone", () => {
    expect(planResolution(thesis({ status: "resolved", entryPrice: 100, exitPrice: 103 }), closes, now)).toBeNull();
  });
});
