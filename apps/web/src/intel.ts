import { type AnalyzedEvent, type Move, Region, type ThreadsResponse, Topic } from "@foresight/shared";

// Państwo → Region (CONTEXT.md). Granice teatrów są umowne: najpierw wyjątki po nazwie,
// potem prostokąty po środku ciężkości państwa ([długość, szerokość]).
const BY_NAME: Record<string, Region | null> = {
  Antarctica: null,
  Russia: "russia-eurasia",
  Georgia: "russia-eurasia",
  Armenia: "russia-eurasia",
  Turkey: "middle-east",
  Egypt: "middle-east",
  Eritrea: "africa",
};

export function regionOfCountry(name: string, [lon, lat]: [number, number]): Region | null {
  if (name in BY_NAME) return BY_NAME[name] ?? null;
  if (lon < -30) return lat >= 24 ? "north-america" : "latin-america";
  if (lon >= 45 && lon <= 90 && lat >= 37) return "russia-eurasia";
  if (lon >= 34 && lon <= 63 && lat >= 12 && lat <= 42) return "middle-east";
  if (lon > 60) return "asia-pacific";
  return lat >= 35 ? "europe" : "africa";
}

export interface Briefing {
  /** Zdarzenia z Wagą ≥ 2 z ostatnich 24 h. */
  regions: Record<Region, number>;
  topics: Record<Topic, number>;
  totals: { events: number; significant: number; breakthrough: number; pending: number };
  /** Najcięższe Zdarzenia z 24 h: Waga malejąco, potem od najnowszych. */
  top: AnalyzedEvent[];
}

const zeros = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

export function briefing(events: readonly AnalyzedEvent[], now: Date): Briefing {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const day = events.filter((e) => e.publishedAt >= since);
  const significant = day.filter((e) => (e.analysis?.weight ?? 0) >= 2);

  const regions = zeros(Region.options);
  const topics = zeros(Topic.options);
  for (const { analysis } of significant) {
    for (const r of analysis?.regions ?? []) regions[r]++;
    for (const t of analysis?.topics ?? []) topics[t]++;
  }

  return {
    regions,
    topics,
    totals: {
      events: day.length,
      significant: significant.length,
      breakthrough: day.filter((e) => e.analysis?.weight === 3).length,
      pending: day.filter((e) => !e.analysis).length,
    },
    top: significant.toSorted(
      (a, b) => (b.analysis?.weight ?? 0) - (a.analysis?.weight ?? 0) || b.publishedAt.localeCompare(a.publishedAt),
    ),
  };
}

export interface Freshness {
  text: string;
  /** No new Event for over 2 h — the hourly worker has likely stopped. */
  stale: boolean;
}

/** How long ago the worker last brought an Event (by fetch time, not publication time). */
export function freshness(events: readonly AnalyzedEvent[], now: Date): Freshness | null {
  if (events.length === 0) return null;
  const newest = events.reduce((max, e) => (e.fetchedAt > max ? e.fetchedAt : max), events[0]?.fetchedAt ?? "");
  const minutes = Math.floor((now.getTime() - Date.parse(newest)) / 60_000);
  const ago = minutes < 1 ? "przed chwilą" : minutes < 120 ? `${minutes} min temu` : `${Math.floor(minutes / 60)} h temu`;
  return { text: `ostatnie Zdarzenie: ${ago}`, stale: minutes > 120 };
}

type ListedThread = ThreadsResponse["threads"][number];

/** Ruch with the Thread it belongs to and the report it came from. */
export interface ThreadMove {
  thread: Pick<ListedThread, "id" | "name">;
  move: Move;
  at: string;
}

export interface ThreadBriefing {
  /** Active (not dormant) Threads touching each Region. */
  regions: Record<Region, number>;
  active: ListedThread[];
  /** Moves of reports written in the last 24 h, newest first. */
  moves: ThreadMove[];
}

export function threadBriefing(threads: readonly ListedThread[], now: Date): ThreadBriefing {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();
  const active = threads.filter((t) => !t.dormant);
  const regions = zeros(Region.options);
  for (const t of active) for (const r of t.regions) regions[r]++;
  const moves = threads
    .filter((t) => t.reportedAt && t.reportedAt >= since)
    .toSorted((a, b) => (b.reportedAt ?? "").localeCompare(a.reportedAt ?? ""))
    .flatMap((t) => (t.moves ?? []).map((move) => ({ thread: { id: t.id, name: t.name }, move, at: t.reportedAt ?? "" })));
  return { regions, active, moves };
}
