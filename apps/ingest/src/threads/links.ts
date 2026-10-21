import { randomUUID } from "node:crypto";
import { type Analysis, type Event, isDormant, type SourceTier, type Thread, type TimelineEntry } from "@foresight/shared";
import type { ActiveThread } from "../analysis/prompt.js";
import type { ThreadStore } from "./store.js";

/** At most this many Threads go into the dispatch prompt (ADR 0008). */
export const MAX_PROMPT_THREADS = 30;

export interface ThreadLinks {
  /** Threads the model may attach to; reads the list once per run. */
  active(): Promise<ActiveThread[]>;
  /** Puts an analyzed Event on the timeline its Thread decision names. */
  link(event: Event, analysis: Analysis): Promise<void>;
}

export interface ThreadLinksOptions {
  store: ThreadStore;
  tierOf: (source: string) => SourceTier;
  now?: () => Date;
  newId?: () => string;
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("pl") === b.trim().toLocaleLowerCase("pl");

// Active Threads and New situations still waiting for the owner: attaching to a proposal keeps
// five headlines about one story from opening five proposals. Most recent first, capped.
export function promptThreads(threads: Thread[], now: Date): ActiveThread[] {
  return threads
    .filter((t) => (t.status === "active" || t.status === "proposed") && !isDormant(t, now))
    .toSorted((a, b) => b.lastEventAt.localeCompare(a.lastEventAt))
    .slice(0, MAX_PROMPT_THREADS)
    .map(({ id, name }) => ({ id, name }));
}

export function createThreadLinks({
  store,
  tierOf,
  now = () => new Date(),
  newId = () => randomUUID().replaceAll("-", "").slice(0, 8),
}: ThreadLinksOptions): ThreadLinks {
  let threads: Thread[] = [];

  async function threadFor(decision: Analysis["thread"], at: string, publishedAt: string): Promise<Thread | undefined> {
    if (decision.kind === "attach") return threads.find((t) => t.id === decision.threadId);
    if (decision.kind !== "propose") return undefined;
    const open = threads.find((t) => t.status === "proposed" && sameName(t.name, decision.name));
    if (open) return open;
    const created: Thread = {
      id: newId(),
      name: decision.name.trim(),
      status: "proposed",
      createdAt: at,
      lastEventAt: publishedAt,
      eventCount: 0,
      newEvents: 0,
      newWeight: 0,
      regions: [],
    };
    await store.create(created);
    threads.push(created);
    return created;
  }

  return {
    async active() {
      threads = await store.list();
      return promptThreads(threads, now());
    },
    async link(event, analysis) {
      const linkedAt = now().toISOString();
      const thread = await threadFor(analysis.thread, linkedAt, event.publishedAt);
      if (!thread) return;
      const entry: TimelineEntry = {
        eventId: event.id,
        title: event.title,
        url: event.url,
        source: event.source,
        tier: tierOf(event.source),
        publishedAt: event.publishedAt,
        linkedAt,
        weight: analysis.weight,
        whyItMatters: analysis.whyItMatters,
        actors: analysis.actors,
        regions: analysis.regions,
      };
      const patch = {
        lastEventAt: [thread.lastEventAt, event.publishedAt].toSorted().at(-1) ?? event.publishedAt,
        newWeight: Math.max(thread.newWeight, analysis.weight),
        regions: [...new Set([...thread.regions, ...analysis.regions])].slice(0, 8),
      };
      await store.link(thread.id, entry, patch);
      Object.assign(thread, patch, { eventCount: thread.eventCount + 1, newEvents: thread.newEvents + 1 });
    },
  };
}
