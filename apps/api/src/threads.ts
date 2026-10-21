import type { ProposalDecision, SituationReport, Thread, TimelineEntry } from "@foresight/shared";

export interface ThreadView {
  thread: Thread;
  report: SituationReport | null;
  timeline: TimelineEntry[];
}

export type DecisionResult = "ok" | "not-found" | "conflict";

// The web side of the `threads` table (docs/data-model.md): public reads, and the owner's
// decisions on New situations — the only writes the web role may make.
export interface ThreadDirectory {
  /** Every Thread, whatever its status. */
  list(): Promise<Thread[]>;
  /** A Thread with its latest report and timeline (newest first), or null. */
  get(id: string): Promise<ThreadView | null>;
  /** New situations waiting for the owner, each with its timeline. */
  proposals(): Promise<Omit<ThreadView, "report">[]>;
  /** Accepts, merges or rejects a New situation; only a proposal can be decided, once. */
  decide(id: string, decision: ProposalDecision): Promise<DecisionResult>;
}

export const TIMELINE_LIMIT = 100;

const newestFirst = (entries: TimelineEntry[]) => entries.toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export class InMemoryThreadDirectory implements ThreadDirectory {
  readonly threads = new Map<string, Thread>();

  constructor(
    threads: Thread[] = [],
    readonly entries: Record<string, TimelineEntry[]> = {},
    readonly reports: Record<string, SituationReport> = {},
  ) {
    for (const thread of threads) this.threads.set(thread.id, thread);
  }

  async list() {
    return [...this.threads.values()];
  }

  async get(id: string) {
    const thread = this.threads.get(id);
    if (!thread) return null;
    return { thread, report: this.reports[id] ?? null, timeline: newestFirst(this.entries[id] ?? []).slice(0, TIMELINE_LIMIT) };
  }

  async proposals() {
    return [...this.threads.values()]
      .filter((t) => t.status === "proposed")
      .map((thread) => ({ thread, timeline: newestFirst(this.entries[thread.id] ?? []) }));
  }

  async decide(id: string, decision: ProposalDecision): Promise<DecisionResult> {
    const proposal = this.threads.get(id);
    if (!proposal) return "not-found";
    if (proposal.status !== "proposed") return "conflict";
    if (decision.action === "accept") {
      this.threads.set(id, { ...proposal, status: "active", ...(decision.name && { name: decision.name }) });
      return "ok";
    }
    if (decision.action === "reject") {
      this.threads.set(id, { ...proposal, status: "rejected" });
      return "ok";
    }
    const target = this.threads.get(decision.into);
    if (!target) return "not-found";
    if (target.status !== "active") return "conflict";
    const moved = this.entries[id] ?? [];
    this.entries[target.id] = [...(this.entries[target.id] ?? []), ...moved];
    this.threads.set(target.id, mergeInto(target, moved));
    this.threads.set(id, { ...proposal, status: "merged", mergedInto: target.id });
    return "ok";
  }
}

/** What the target Thread looks like after taking over a proposal's timeline. */
export function mergeInto(target: Thread, moved: TimelineEntry[]): Thread {
  return {
    ...target,
    lastEventAt: [target.lastEventAt, ...moved.map((e) => e.publishedAt)].toSorted().at(-1) ?? target.lastEventAt,
    eventCount: target.eventCount + moved.length,
    newEvents: target.newEvents + moved.length,
    newWeight: Math.max(target.newWeight, ...moved.map((e) => e.weight)),
    regions: [...new Set([...target.regions, ...moved.flatMap((e) => e.regions)])].slice(0, 8),
  };
}
