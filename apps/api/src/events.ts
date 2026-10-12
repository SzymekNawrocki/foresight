import type { Event } from "@foresight/shared";

export interface EventReader {
  /** The newest `limit` Events, newest first. */
  latest(limit: number): Promise<Event[]>;
}

export class InMemoryEventReader implements EventReader {
  constructor(private readonly events: Event[] = []) {}

  async latest(limit: number) {
    return this.events.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
  }
}
