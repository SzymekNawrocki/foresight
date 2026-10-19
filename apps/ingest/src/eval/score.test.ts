import { describe, expect, it } from "vitest";
import { validAnalysis } from "../analysis/fixtures.js";
import { scoreCase } from "./score.js";

const base = { source: "oilprice", title: "Hormuz" };

describe("scoreCase", () => {
  it("passes every check of a matching Analysis", () => {
    expect(scoreCase({ ...base, regions: ["middle-east"], topicsAny: ["energy", "cyber"], weight: [2, 3] }, validAnalysis)).toEqual({
      title: "Hormuz",
      passed: 3,
      total: 3,
      misses: [],
    });
  });

  it("names each miss", () => {
    const score = scoreCase({ ...base, regions: ["middle-east", "europe"], noTopics: true, weight: [3, 3] }, validAnalysis);

    expect(score).toMatchObject({ passed: 1, total: 4 });
    expect(score.misses).toEqual([
      "regions: no europe (got middle-east)",
      "topics: expected none (got energy, sanctions-trade)",
      "weight: 2 not in 3–3",
    ]);
  });

  it("fails all checks when the model gave no Analysis", () => {
    expect(scoreCase({ ...base, regions: ["middle-east"], topicsAny: ["energy"], weight: [1, 3] }, undefined)).toEqual({
      title: "Hormuz",
      passed: 0,
      total: 3,
      misses: ["no Analysis"],
    });
  });
});
