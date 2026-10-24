import type { Event, Verdict } from "@foresight/shared";
import type { RecentAnalysis } from "./duplicate.js";

export interface AnalysisQueue {
  /** The newest Events that have no Analysis yet. */
  pending(limit: number): Promise<Event[]>;
  saveAnalysis(eventId: string, verdict: Verdict): Promise<void>;
  /** How many Events still wait — the alarm "Analysis stalled" watches this number. */
  backlog(): Promise<number>;
  /** Titles and Analyses of Events published since `since` (ISO time) — candidates for a near-duplicate. */
  recent(since: string): Promise<RecentAnalysis[]>;
}
