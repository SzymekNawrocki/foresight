import type { Event } from "@foresight/shared";
import type { SourceTier } from "./sources.js";

export interface EventStore {
  /** Saves the Event, queued for Analysis under its Source tier, unless one with the same id exists. Returns true if it was new. */
  putIfAbsent(event: Event, tier: SourceTier): Promise<boolean>;
}

export class InMemoryEventStore implements EventStore {
  readonly #events = new Map<string, Event>();

  get size() {
    return this.#events.size;
  }

  /** Newest first, by publication date. */
  latest(limit: number): Event[] {
    return [...this.#events.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit);
  }

  async putIfAbsent(event: Event) {
    if (this.#events.has(event.id)) return false;
    this.#events.set(event.id, event);
    return true;
  }
}
