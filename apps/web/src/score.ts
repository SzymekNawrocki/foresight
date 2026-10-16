import { Region, type Thesis, Topic } from "@foresight/shared";

// Wynik (CONTEXT.md): accuracy from resolved Theses — overall, per Region and per Topic.
export interface Tally {
  resolved: number;
  hits: number;
  open: number;
}

const empty = (): Tally => ({ resolved: 0, hits: 0, open: 0 });
const tallies = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, empty()])) as Record<K, Tally>;

function add(tally: Tally, thesis: Thesis) {
  if (thesis.status === "open") tally.open++;
  else {
    tally.resolved++;
    if (thesis.hit) tally.hits++;
  }
}

export function score(theses: readonly Thesis[]) {
  const result = { overall: empty(), regions: tallies(Region.options), topics: tallies(Topic.options) };
  for (const thesis of theses) {
    add(result.overall, thesis);
    for (const r of thesis.regions) add(result.regions[r], thesis);
    for (const t of thesis.topics) add(result.topics[t], thesis);
  }
  return result;
}

export const accuracy = ({ resolved, hits }: Tally) => (resolved ? `${Math.round((hits / resolved) * 100)}%` : "—");
