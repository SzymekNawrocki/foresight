import type { Event } from "@foresight/shared";

export interface EventStore {
  /** Saves the Event unless one with the same id exists. Returns true if it was new. */
  putIfAbsent(event: Event): Promise<boolean>;
}

export class InMemoryEventStore implements EventStore {
  readonly #events = new Map<string, Event>();

  get size() {
    return this.#events.size;
  }

  async putIfAbsent(event: Event) {
    if (this.#events.has(event.id)) return false;
    this.#events.set(event.id, event);
    return true;
  }
}
