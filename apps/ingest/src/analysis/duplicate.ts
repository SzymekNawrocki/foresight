import type { Verdict } from "@foresight/shared";

/** An Event analyzed recently: a new Event with a near-identical title reuses its Analysis. */
export interface RecentAnalysis {
  title: string;
  analysis: Verdict;
}

// Two newsrooms often run the same story under slightly different headlines. Reusing the first
// Analysis saves a model call; a false match would put one story's Analysis on another, so the
// rule is strict — on 379 real Events (October 2026) it caught the clear rewordings and no
// different news. Calibration pairs live in duplicate.test.ts.
const THRESHOLD = 0.5;
const MIN_WORDS = 3;

const STOP = new Set(
  "a an the of to in on for and or as at by with from is are was be after over amid says say said its it this that into new".split(" "),
);
const UP = new Set(["rise", "rises", "rising", "up", "higher", "gain", "gains", "jump", "jumps", "surge", "surges", "soar", "soars", "climb", "climbs"]);
const DOWN = new Set(["fall", "falls", "falling", "down", "lower", "drop", "drops", "slump", "slumps", "plunge", "plunges", "slide", "slides", "decline", "declines"]);

interface Fingerprint {
  words: Set<string>;
  numbers: string;
  up: boolean;
  down: boolean;
}

function fingerprint(title: string): Fingerprint {
  const text = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']s\b/g, "");
  const numbers = [...new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? [])].sort().join(" ");
  const all = text.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/);
  const words = new Set(all.filter((w) => w.length > 1 && !/^\d+$/.test(w) && !STOP.has(w)));
  return { words, numbers, up: all.some((w) => UP.has(w)), down: all.some((w) => DOWN.has(w)) };
}

function similar(a: Fingerprint, b: Fingerprint) {
  if (a.words.size < MIN_WORDS || b.words.size < MIN_WORDS) return 0;
  // A different figure or an opposite move is different news, however alike the rest.
  if (a.numbers !== b.numbers) return 0;
  if ((a.up && b.down) || (a.down && b.up)) return 0;
  let shared = 0;
  for (const word of a.words) if (b.words.has(word)) shared++;
  return shared / (a.words.size + b.words.size - shared);
}

export const isNearDuplicate = (a: string, b: string) => similar(fingerprint(a), fingerprint(b)) >= THRESHOLD;

/** The Analysis of the most similar recent Event, if one is close enough. */
export function findDuplicate(title: string, recent: readonly RecentAnalysis[]): Verdict | undefined {
  const target = fingerprint(title);
  let best: { score: number; analysis: Verdict } | undefined;
  for (const candidate of recent) {
    const score = similar(target, fingerprint(candidate.title));
    if (score >= THRESHOLD && score > (best?.score ?? 0)) best = { score, analysis: candidate.analysis };
  }
  return best?.analysis;
}
