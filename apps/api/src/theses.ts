import type { Thesis } from "@foresight/shared";

export interface ThesisStore {
  put(owner: string, thesis: Thesis): Promise<void>;
  /** The owner's Theses, newest first. */
  list(owner: string): Promise<Thesis[]>;
}

export class InMemoryThesisStore implements ThesisStore {
  readonly #byOwner = new Map<string, Thesis[]>();

  async put(owner: string, thesis: Thesis) {
    this.#byOwner.set(owner, [...(this.#byOwner.get(owner) ?? []), thesis]);
  }

  async list(owner: string) {
    return (this.#byOwner.get(owner) ?? []).toSorted((a, b) => b.id.localeCompare(a.id));
  }
}
