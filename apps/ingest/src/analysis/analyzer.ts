import type { Analysis, Event } from "@foresight/shared";

export type AnalysisFailure = "rate-limited" | "timeout" | "invalid" | `http-${number}` | "network";

export type AnalysisResult = { ok: true; analysis: Analysis } | { ok: false; reason: AnalysisFailure };

export interface Analyzer {
  /** One LLM call for one Event. Never throws; a failure leaves the Event for a later run. */
  analyze(event: Event): Promise<AnalysisResult>;
}

export interface AnalysisStore {
  saveAnalysis(eventId: string, analysis: Analysis): Promise<void>;
}

export interface AnalysisQueue extends AnalysisStore {
  /** The newest Events that have no Analysis yet. */
  pending(limit: number): Promise<Event[]>;
}
