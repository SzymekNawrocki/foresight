import type { Analysis, Event } from "@foresight/shared";

export interface AnalysisQueue {
  /** The newest Events that have no Analysis yet. */
  pending(limit: number): Promise<Event[]>;
  saveAnalysis(eventId: string, analysis: Analysis): Promise<void>;
  /** How many Events still wait — the alarm "Analysis stalled" watches this number. */
  backlog(): Promise<number>;
}
