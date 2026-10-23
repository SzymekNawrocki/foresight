import { describe, expect, it } from "vitest";
import { validAnalysis } from "../analysis/fixtures.js";
import { type EvalDispatch, fromVerdict, scoreCase } from "./score.js";

const base = { source: "the-record", title: "APT28 hits Polish grid" };

const dispatch: EvalDispatch = {
  niche: true,
  topics: ["cyber"],
  companies: [
    { company: "CRWD", direction: "up" },
    { company: "PANW", direction: "uncertain" },
  ],
  weight: 2,
};

describe("scoreCase — niche case", () => {
  const expected = {
    ...base,
    niche: true as const,
    topicsAny: ["cyber" as const],
    companies: { CRWD: "up" as const, PANW: "any" as const, FTNT: "up" as const },
    weight: [2, 3] as [2, 3],
  };

  it("passes every check of a matching dispatch", () => {
    expect(scoreCase(expected, dispatch)).toEqual({ title: base.title, passed: 5, total: 5, misses: [] });
  });

  it("names each miss", () => {
    const score = scoreCase(expected, {
      niche: true,
      topics: ["ai"],
      companies: [
        { company: "CRWD", direction: "down" },
        { company: "NVDA", direction: "up" },
      ],
      weight: 1,
    });

    expect(score).toMatchObject({ passed: 1, total: 5 });
    expect(score.misses).toEqual([
      "topics: none of cyber (got ai)",
      "companies: NVDA not expected",
      "direction: CRWD down, expected up",
      "weight: 1 not in 2–3",
    ]);
  });

  it("fails when a niche Event is dropped", () => {
    const score = scoreCase(expected, { niche: false, topics: [], companies: [], weight: 1 });

    expect(score.passed).toBe(2); // no stray Company and no wrong direction — nothing was returned
    expect(score.misses[0]).toBe("niche: dropped a niche Event");
  });

  it("skips the Company checks when the case names no Companies", () => {
    expect(scoreCase({ ...base, niche: true, topicsAny: ["cyber"], weight: [2, 3] }, dispatch)).toMatchObject({ passed: 3, total: 3 });
  });
});

describe("scoreCase — out-of-niche case", () => {
  it("passes when the Event is dropped", () => {
    expect(scoreCase({ ...base, niche: false }, { niche: false, topics: [], companies: [], weight: 1 })).toEqual({
      title: base.title,
      passed: 1,
      total: 1,
      misses: [],
    });
  });

  it("fails when noise gets in", () => {
    expect(scoreCase({ ...base, niche: false }, dispatch).misses).toEqual(["niche: let in an out-of-niche Event"]);
  });
});

describe("scoreCase — no answer", () => {
  it("fails all checks", () => {
    expect(scoreCase({ ...base, niche: true, topicsAny: ["cyber"], weight: [1, 3] }, undefined)).toEqual({
      title: base.title,
      passed: 0,
      total: 3,
      misses: ["no dispatch"],
    });
  });
});

describe("fromVerdict", () => {
  it("reads Topics, Companies and weight of a niche Analysis", () => {
    expect(fromVerdict(validAnalysis)).toEqual({
      niche: true,
      topics: ["cyber"],
      companies: validAnalysis.companies,
      weight: 2,
    });
  });

  it("reads an Event off the Niche as dropped", () => {
    expect(fromVerdict({ niche: false })).toMatchObject({ niche: false, topics: [], companies: [] });
  });
});
