import type { Move, Region, SituationReport, Thread, ThreadStatus, TimelineEntry } from "@foresight/shared";

/** What a new timeline entry changes on its Thread; counters are added by the store. */
export interface LinkPatch {
  lastEventAt: string;
  newWeight: number;
  regions: Region[];
}

/** What the owner may change on a Thread outside the browser. */
export interface ThreadChange {
  status?: ThreadStatus;
  name?: string;
}

/** What a new report changes on its Thread. */
export interface ReportSummary {
  lead: NonNullable<Thread["lead"]>;
  moves: Move[];
}

// The worker's view of the `threads` table (docs/data-model.md). Updates name only the fields
// the worker owns, so an owner decision made during a run (accept, merge) is never overwritten.
export interface ThreadStore {
  /** Every Thread, whatever its status. */
  list(): Promise<Thread[]>;
  /** A New situation proposed by the model; fails if the id is taken. */
  create(thread: Thread): Promise<void>;
  /** Writes the timeline entry and bumps the counters of its Thread. */
  link(threadId: string, entry: TimelineEntry, patch: LinkPatch): Promise<void>;
  /** Timeline entries, newest first. */
  timeline(threadId: string, limit: number): Promise<TimelineEntry[]>;
  latestReport(threadId: string): Promise<SituationReport | null>;
  /** Keeps the report as a new version and resets the "new since report" counters. */
  saveReport(threadId: string, report: SituationReport, summary: ReportSummary): Promise<void>;
  /** An owner change (seed command): applied only while the status is still `expected`; false on conflict. */
  update(threadId: string, change: ThreadChange, expected: ThreadStatus): Promise<boolean>;
}

export class InMemoryThreadStore implements ThreadStore {
  readonly threads = new Map<string, Thread>();
  readonly entries = new Map<string, TimelineEntry[]>();
  readonly reports = new Map<string, SituationReport[]>();

  constructor(threads: Thread[] = [], entries: Record<string, TimelineEntry[]> = {}) {
    for (const thread of threads) this.threads.set(thread.id, thread);
    for (const [id, list] of Object.entries(entries)) this.entries.set(id, list);
  }

  async list() {
    return [...this.threads.values()];
  }

  async create(thread: Thread) {
    if (this.threads.has(thread.id)) throw new Error(`Thread ${thread.id} exists`);
    this.threads.set(thread.id, thread);
  }

  async link(threadId: string, entry: TimelineEntry, patch: LinkPatch) {
    const thread = this.threads.get(threadId);
    if (!thread) throw new Error(`No Thread ${threadId}`);
    this.entries.set(threadId, [...(this.entries.get(threadId) ?? []), entry]);
    this.threads.set(threadId, {
      ...thread,
      ...patch,
      eventCount: thread.eventCount + 1,
      newEvents: thread.newEvents + 1,
    });
  }

  async timeline(threadId: string, limit: number) {
    return (this.entries.get(threadId) ?? [])
      .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, limit);
  }

  async latestReport(threadId: string) {
    return this.reports.get(threadId)?.at(-1) ?? null;
  }

  async saveReport(threadId: string, report: SituationReport, summary: ReportSummary) {
    this.reports.set(threadId, [...(this.reports.get(threadId) ?? []), report]);
    const thread = this.threads.get(threadId);
    if (thread) {
      this.threads.set(threadId, { ...thread, ...summary, reportedAt: report.createdAt, newEvents: 0, newWeight: 0 });
    }
  }

  async update(threadId: string, change: ThreadChange, expected: ThreadStatus) {
    const thread = this.threads.get(threadId);
    if (thread?.status !== expected) return false;
    this.threads.set(threadId, { ...thread, ...change });
    return true;
  }
}
