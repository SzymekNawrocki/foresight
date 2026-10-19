import type { Analysis } from "@foresight/shared";
import type { EvalCase } from "./cases.js";

export interface CaseScore {
  title: string;
  passed: number;
  total: number;
  /** What failed, e.g. "regions: no russia-eurasia". Empty when everything passed. */
  misses: string[];
}

// Each expectation in a case is one check; a missing Analysis fails all of them.
export function scoreCase(expected: EvalCase, analysis: Analysis | undefined): CaseScore {
  const checks: [ok: boolean, miss: string][] = [];
  const [min, max] = expected.weight;
  if (!analysis) {
    const total = 1 + (expected.regions?.length ?? 0) + (expected.topicsAny ? 1 : 0) + (expected.noTopics ? 1 : 0);
    return { title: expected.title, passed: 0, total, misses: ["no Analysis"] };
  }

  for (const region of expected.regions ?? []) {
    checks.push([analysis.regions.includes(region), `regions: no ${region} (got ${analysis.regions.join(", ")})`]);
  }
  if (expected.topicsAny) {
    checks.push([
      expected.topicsAny.some((t) => analysis.topics.includes(t)),
      `topics: none of ${expected.topicsAny.join("/")} (got ${analysis.topics.join(", ") || "none"})`,
    ]);
  }
  if (expected.noTopics) {
    checks.push([analysis.topics.length === 0, `topics: expected none (got ${analysis.topics.join(", ")})`]);
  }
  checks.push([analysis.weight >= min && analysis.weight <= max, `weight: ${analysis.weight} not in ${min}–${max}`]);

  return {
    title: expected.title,
    passed: checks.filter(([ok]) => ok).length,
    total: checks.length,
    misses: checks.filter(([ok]) => !ok).map(([, miss]) => miss),
  };
}
