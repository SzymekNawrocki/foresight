import type { Analysis, Topic } from "@foresight/shared";
import type { EvalCase, NicheTopic } from "./cases.js";

export type Direction = "up" | "down" | "uncertain";

/** What the eval reads from one dispatch, whatever its version. */
export interface EvalDispatch {
  niche: boolean;
  topics: NicheTopic[];
  companies: { company: string; direction: Direction }[];
  weight: number;
}

export interface CaseScore {
  title: string;
  passed: number;
  total: number;
  /** What failed, e.g. "topics: none of cyber (got ai)". Empty when everything passed. */
  misses: string[];
}

// The baseline prompt (v2) has no niche flag. Its closest proxy is a tech Topic; drones and the
// defence industry have no axis there, so the baseline cannot catch them.
const V2_TECH: Partial<Record<Topic, NicheTopic>> = { cyber: "cyber", ai: "ai", space: "space", semiconductors: "chips" };

export function fromV2(analysis: Analysis): EvalDispatch {
  const topics = analysis.topics.flatMap((t) => V2_TECH[t] ?? []);
  return { niche: topics.length > 0, topics, companies: [], weight: analysis.weight };
}

function checksOf(expected: EvalCase, got: EvalDispatch): [ok: boolean, miss: string][] {
  if (!expected.niche) return [[!got.niche, "niche: let in an out-of-niche Event"]];

  const checks: [boolean, string][] = [
    [got.niche, "niche: dropped a niche Event"],
    [
      expected.topicsAny.some((t) => got.topics.includes(t)),
      `topics: none of ${expected.topicsAny.join("/")} (got ${got.topics.join(", ") || "none"})`,
    ],
  ];
  if (expected.companies) {
    const allowed = expected.companies;
    const stray = got.companies.filter((c) => !(c.company in allowed)).map((c) => c.company);
    const wrong = got.companies.filter((c) => {
      const want = allowed[c.company];
      return want !== undefined && want !== "any" && want !== c.direction;
    });
    checks.push([stray.length === 0, `companies: ${stray.join(", ")} not expected`]);
    checks.push([
      wrong.length === 0,
      `direction: ${wrong.map((c) => `${c.company} ${c.direction}, expected ${allowed[c.company]}`).join("; ")}`,
    ]);
  }
  const [min, max] = expected.weight;
  checks.push([got.weight >= min && got.weight <= max, `weight: ${got.weight} not in ${min}–${max}`]);
  return checks;
}

// Each expectation in a case is one check; a missing dispatch fails all of them.
export function scoreCase(expected: EvalCase, got: EvalDispatch | undefined): CaseScore {
  if (!got) {
    const total = expected.niche ? 3 + (expected.companies ? 2 : 0) : 1;
    return { title: expected.title, passed: 0, total, misses: ["no dispatch"] };
  }
  const checks = checksOf(expected, got);
  return {
    title: expected.title,
    passed: checks.filter(([ok]) => ok).length,
    total: checks.length,
    misses: checks.filter(([ok]) => !ok).map(([, miss]) => miss),
  };
}
