import type { Thesis } from "@foresight/shared";
import { describe, expect, it, vi } from "vitest";
import type { Resolution } from "./resolve.js";
import { type OpenThesis, runResolve } from "./run.js";
import type { PriceSource } from "./tiingo.js";

const base: Thesis = {
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
};
const now = new Date("2026-10-24T06:00:00.000Z");

function setup(open: OpenThesis[], prices: PriceSource) {
  const updates: [string, string, Resolution][] = [];
  const run = () =>
    runResolve({
      store: { open: async () => open, update: async (owner, id, r) => void updates.push([owner, id, r]) },
      prices,
      now: () => now,
    });
  return { updates, run };
}

describe("runResolve", () => {
  it("asks once per Instrument, from the oldest Thesis to today, and writes what is due", async () => {
    const closes = vi.fn(async () => [
      { date: "2026-10-16", close: 100 },
      { date: "2026-10-23", close: 90 },
    ]);
    const { updates, run } = setup(
      [
        { owner: "o", thesis: base },
        { owner: "o", thesis: { ...base, id: "2026-10-17T12:00:00.000Z#11111111", createdAt: "2026-10-17T12:00:00.000Z", resolveAt: "2026-12-01T12:00:00.000Z" } },
      ],
      { closes },
    );

    await expect(run()).resolves.toEqual({ open: 2, updated: 2, resolved: 1, errors: [] });
    expect(closes).toHaveBeenCalledTimes(1);
    expect(closes).toHaveBeenCalledWith("BNO", "2026-10-16", "2026-10-24");
    expect(updates[0]).toEqual(["o", base.id, expect.objectContaining({ actual: "down", hit: false, status: "resolved" })]);
  });

  it("does not call the price source when nothing is due", async () => {
    const closes = vi.fn();
    const { run } = setup([{ owner: "o", thesis: { ...base, entryPrice: 100, resolveAt: "2026-12-01T12:00:00.000Z" } }], { closes });

    await expect(run()).resolves.toEqual({ open: 1, updated: 0, resolved: 0, errors: [] });
    expect(closes).not.toHaveBeenCalled();
  });

  it("keeps going when one Instrument's prices fail", async () => {
    const closes = vi.fn(async (instrument: string) => {
      if (instrument === "BNO") throw new Error("Tiingo BNO: HTTP 500");
      return [{ date: "2026-10-16", close: 50 }];
    });
    const { updates, run } = setup(
      [
        { owner: "o", thesis: base },
        { owner: "o", thesis: { ...base, id: "2026-10-16T12:00:00.000Z#22222222", instrument: "GLD", resolveAt: "2026-12-01T12:00:00.000Z" } },
      ],
      { closes },
    );

    await expect(run()).resolves.toEqual({ open: 2, updated: 1, resolved: 0, errors: ["Tiingo BNO: HTTP 500"] });
    expect(updates).toHaveLength(1);
  });
});
