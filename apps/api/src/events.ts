import type { AnalyzedEvent } from "@foresight/shared";

export interface EventReader {
  /** The newest `limit` Events, newest first. */
  latest(limit: number): Promise<AnalyzedEvent[]>;
  /** Events published at or after `since` (ISO), newest first, at most `max`. */
  since(since: string, max: number): Promise<AnalyzedEvent[]>;
}

export class InMemoryEventReader implements EventReader {
  constructor(private readonly events: AnalyzedEvent[] = []) {}

  async latest(limit: number) {
    return this.events.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
  }

  async since(since: string, max: number) {
    return (await this.latest(this.events.length)).filter((e) => e.publishedAt >= since).slice(0, max);
  }
}
