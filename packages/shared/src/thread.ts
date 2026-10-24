import { z } from "zod";
import { Actor, Region, Topic, Weight } from "./analysis.js";

// Threads, their timelines and Situation reports (CONTEXT.md: Wątek, Nowa sytuacja, Raport
// sytuacyjny, Sygnał ostrzegawczy, Prawdopodobieństwo, Ruch). Items in the `threads` table:
// docs/data-model.md.

export const ThreadId = z.string().regex(/^[0-9a-f]{8}$/);

/** A Thread is active while it had an Event in the last 14 days; after that it is dormant. */
export const DORMANT_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export const SourceTier = z.enum(["A", "B", "C"]);
export type SourceTier = z.infer<typeof SourceTier>;

/** ICD 203 words of estimative probability, lowest first — the index is the rank. */
export const LIKELIHOOD = [
  "prawie wykluczone",
  "bardzo mało prawdopodobne",
  "mało prawdopodobne",
  "mniej więcej po równo",
  "prawdopodobne",
  "bardzo prawdopodobne",
  "niemal pewne",
] as const;
export const Likelihood = z.enum(LIKELIHOOD);
export type Likelihood = z.infer<typeof Likelihood>;

export const ScenarioKind = z.enum(["escalation", "status-quo", "deescalation"]);
export type ScenarioKind = z.infer<typeof ScenarioKind>;

/** Change against the previous report, computed in code: `new` when there was none. */
export const LikelihoodChange = z.enum(["up", "down", "same", "new"]);
export type LikelihoodChange = z.infer<typeof LikelihoodChange>;

/** A short copy of a dispatch on the timeline of a Thread. */
export const TimelineEntry = z.object({
  eventId: z.string().regex(/^[0-9a-f]{32}$/),
  title: z.string().max(300),
  url: z.url({ protocol: /^https$/ }),
  source: z.string().max(64),
  tier: SourceTier,
  publishedAt: z.iso.datetime(),
  /** When the entry joined the Thread — a report reads the entries added since its previous version. */
  linkedAt: z.iso.datetime(),
  weight: Weight,
  whyItMatters: z.string().max(300),
  actors: z.array(Actor).max(4),
  regions: z.array(Region).max(8),
});
export type TimelineEntry = z.infer<typeof TimelineEntry>;

export const Evidence = TimelineEntry.pick({ eventId: true, title: true, url: true, source: true, tier: true });
export type Evidence = z.infer<typeof Evidence>;

export const WarningSignal = z.object({
  text: z.string().max(200),
  lit: z.boolean(),
  /** Only an Event from a tier A or B Source; code rejects anything else (ADR 0009). */
  evidence: Evidence.optional(),
  litAt: z.iso.datetime().optional(),
});
export type WarningSignal = z.infer<typeof WarningSignal>;

export const ReportScenario = z.object({
  kind: ScenarioKind,
  name: z.string().max(120),
  description: z.string().max(600),
  likelihood: Likelihood,
  change: LikelihoodChange,
  previous: Likelihood.optional(),
  /** Why the rating moved (or did not), written by code from the two versions. */
  reason: z.string().max(400),
  signals: z.array(WarningSignal).max(4),
});
export type ReportScenario = z.infer<typeof ReportScenario>;

export const SituationReport = z.object({
  createdAt: z.iso.datetime(),
  model: z.string().max(64),
  state: z.string().max(1200),
  actors: z.array(z.object({ name: z.string().max(60), interest: z.string().max(300) })).max(6),
  scenarios: z.array(ReportScenario).length(3),
  mostLikely: ScenarioKind,
  assets: z
    .array(z.object({ name: z.string().max(60), direction: z.enum(["up", "down", "mixed"]), why: z.string().max(300) }))
    .max(5),
  relations: z.string().max(800),
  whatChanged: z.string().max(800),
  /** How many Events the report was written from. */
  basedOn: z.int().min(0),
  /** Lit signals the model claimed without valid evidence, dropped by code. */
  rejectedSignals: z.int().min(0),
});
export type SituationReport = z.infer<typeof SituationReport>;

/** Ruch: a Likelihood shift or a newly lit signal in a report. */
export const Move = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("shift"), scenario: z.string().max(120), from: Likelihood, to: Likelihood }),
  z.object({ kind: z.literal("signal"), scenario: z.string().max(120), text: z.string().max(200) }),
]);
export type Move = z.infer<typeof Move>;

export const ThreadStatus = z.enum(["proposed", "active", "rejected", "merged"]);
export type ThreadStatus = z.infer<typeof ThreadStatus>;

/** The Thread itself — one item in the `THREADS` partition, so the list is one Query. */
export const Thread = z.object({
  id: ThreadId,
  name: z.string().max(80),
  status: ThreadStatus,
  createdAt: z.iso.datetime(),
  lastEventAt: z.iso.datetime(),
  eventCount: z.int().min(0),
  /** Entries added since the last report, and their highest Weight — what makes a report due. */
  newEvents: z.int().min(0),
  newWeight: z.int().min(0).max(3),
  regions: z.array(Region).max(8),
  /** Union over its dispatches since slice 12 — how a similar New situation is recognised. */
  topics: z.array(Topic).max(6).optional(),
  actors: z.array(Actor).max(12).optional(),
  reportedAt: z.iso.datetime().optional(),
  lead: z.object({ scenario: z.string().max(120), likelihood: Likelihood, change: LikelihoodChange }).optional(),
  /** Moves of the latest report. */
  moves: z.array(Move).max(12).optional(),
  mergedInto: ThreadId.optional(),
});
export type Thread = z.infer<typeof Thread>;

export const isDormant = (thread: Pick<Thread, "lastEventAt">, now: Date) =>
  now.getTime() - Date.parse(thread.lastEventAt) > DORMANT_AFTER_MS;

// GET /api/threads — active and dormant Threads, most recent first.
export const ThreadsResponse = z.object({ threads: z.array(Thread.extend({ dormant: z.boolean() })).max(200) });
export type ThreadsResponse = z.infer<typeof ThreadsResponse>;

// GET /api/threads/:id — the Thread, its latest report and timeline.
export const ThreadResponse = z.object({
  thread: Thread.extend({ dormant: z.boolean() }),
  report: SituationReport.nullable(),
  timeline: z.array(TimelineEntry).max(100),
});
export type ThreadResponse = z.infer<typeof ThreadResponse>;

// GET /api/threads/proposals (owner) — New situations waiting for a decision.
export const ProposalsResponse = z.object({
  proposals: z.array(z.object({ thread: Thread, timeline: z.array(TimelineEntry).max(100) })).max(100),
});
export type ProposalsResponse = z.infer<typeof ProposalsResponse>;

// POST /api/threads/proposals/:id (owner).
export const ProposalDecision = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("accept"), name: z.string().trim().min(1).max(80).optional() }),
  z.strictObject({ action: z.literal("merge"), into: ThreadId }),
  z.strictObject({ action: z.literal("reject") }),
]);
export type ProposalDecision = z.infer<typeof ProposalDecision>;

/** Keys of the `threads` table (single-table design, ADR 0009). */
export const threadKeys = {
  list: "THREADS",
  thread: (id: string) => `THREAD#${id}`,
  entry: (entry: Pick<TimelineEntry, "publishedAt" | "eventId">) => `EVENT#${entry.publishedAt}#${entry.eventId}`,
  report: (createdAt: string) => `REPORT#${createdAt}`,
} as const;
