import { type AnalyzedEvent, type Region, Topic } from "@foresight/shared";

export interface StreamSearch {
  region?: Region | undefined;
  /** Topics joined with a comma, in the order of Topic.options, e.g. "cyber,space". */
  topic?: string | undefined;
  /** Minimum Weight: 2 = Significant and above, 3 = Breakthrough only. */
  weight?: 2 | 3 | undefined;
}

/** The valid Topics of a filter, deduplicated and in a stable order. */
export const topicsOf = (topic: unknown): Topic[] =>
  typeof topic === "string" ? Topic.options.filter((t) => topic.split(",").includes(t)) : [];

/** Does the Event pass the filter? An Event still waiting for its Analysis passes only an empty filter. */
export function matches(e: AnalyzedEvent, filter: StreamSearch, skipRegion = false): boolean {
  const topics = topicsOf(filter.topic);
  if (!filter.region && !topics.length && !filter.weight) return true;
  const a = e.analysis;
  if (!a) return false;
  if (!skipRegion && filter.region && !a.regions.includes(filter.region)) return false;
  if (topics.length && !topics.some((t) => (a.topics as readonly string[]).includes(t))) return false;
  return !filter.weight || a.weight >= filter.weight;
}
