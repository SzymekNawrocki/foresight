import { Actor, ACTOR_REGION, Analysis, Company, CompanyImpact, type OffNiche, Region, Topic, type Verdict } from "@foresight/shared";
import { z } from "zod";

// The model answers for a whole batch; each dispatch names its Event by position, never by id,
// so nothing from our table goes to the model.
export const BATCH_SIZE = 8;
export const REFS = Array.from({ length: BATCH_SIZE }, (_, i) => `e${i + 1}`);

// Groq strict mode checks enums only after generating, and one label outside a list (the model
// once wrote the Actor "lithuania") fails the whole batch with a 400. So labels go to the model
// as plain strings — the allowed values are listed in the prompt — and settle() keeps the known ones.
const Labels = z.array(z.string());
const Impact = CompanyImpact.extend({ company: z.string() });

// Groq tells anyOf branches apart by a single enum property; with `ref` an enum too it refused
// the schema ("multiple candidate properties niche, ref"). So `ref` goes as a string and the
// e1…e8 check stays in Zod — an unknown ref still drops only its own dispatch.
const Ref = z.string().refine((ref) => REFS.includes(ref));

// Dispatch v3 (ADR 0010): the model first decides whether the Event is in the Niche. An Event off
// the Niche gets a two-field answer, so most of the stream costs a few tokens. Groq strict mode
// has no "const" or boolean branches, hence the one-value string enums.
const NicheDispatch = Analysis.extend({
  ref: Ref,
  niche: z.enum(["yes"]),
  regions: Labels,
  topics: Labels,
  actors: Labels,
  companies: z.array(Impact),
});
const OffNicheDispatch = z.strictObject({ ref: Ref, niche: z.enum(["no"]) });
const Dispatch = z.union([NicheDispatch, OffNicheDispatch]);
export type Dispatch = z.infer<typeof Dispatch>;
type NicheFields = Omit<z.infer<typeof NicheDispatch>, "ref">;
/** A dispatch without its ref — what the batch answer carries for one Event. */
export type DispatchFields = NicheFields | Omit<z.infer<typeof OffNicheDispatch>, "ref">;

// One invalid dispatch (say, a sentence over the limit) turns into null instead of failing the
// whole answer, so only its own Event stays pending. `catch` leaves the JSON schema sent to the
// model unchanged, which is why the null is cast in rather than declared with `nullable`.
export const DispatchBatch = z.strictObject({
  dispatches: z.array(Dispatch.catch(null as unknown as z.infer<typeof Dispatch>)).max(BATCH_SIZE),
});
export type DispatchBatch = z.infer<typeof DispatchBatch>;

const known = <T extends string>(values: readonly T[], labels: string[]) =>
  [...new Set(labels)].filter((label): label is T => (values as readonly string[]).includes(label));

export const OFF_NICHE: OffNiche = { niche: false };

// What the model may not decide on its own (ADR 0009: rules live in code, not in the prompt):
// only labels from our lists survive, an Actor always brings its home Region, a Niche Event
// without a known Topic is off the Niche, each Company appears once and at most 3 times, an attach
// must name a Thread we actually sent, and only a significant Event may propose a New situation.
// Fields are copied one by one, so nothing else the answer carries (such as its ref) is saved.
// A saved Verdict (a near-duplicate) goes through the same rules again.
export function settle(dispatch: DispatchFields | Verdict, activeThreadIds: ReadonlySet<string>): Verdict {
  if (dispatch.niche === "no" || dispatch.niche === false) return OFF_NICHE;
  return settleNiche(dispatch, activeThreadIds);
}

function settleNiche(dispatch: Omit<NicheFields, "niche">, activeThreadIds: ReadonlySet<string>): Verdict {
  const topics = known(Topic.options, dispatch.topics);
  if (topics.length === 0) return OFF_NICHE;
  const companies = dispatch.companies
    .filter((c, i, all): c is CompanyImpact => Company.safeParse(c.company).success && all.findIndex((o) => o.company === c.company) === i)
    .slice(0, 3)
    .map(({ company, direction, mechanism }) => ({ company, direction, mechanism }));
  const actors = known(Actor.options, dispatch.actors).slice(0, 4);
  const homes = actors.flatMap((actor): Region[] => {
    const home = ACTOR_REGION[actor];
    return home ? [home] : [];
  });
  const regions = [...new Set([...known(Region.options, dispatch.regions), ...homes])].slice(0, 8);
  const { thread } = dispatch;
  const keep =
    (thread.kind === "attach" && activeThreadIds.has(thread.threadId)) || (thread.kind === "propose" && dispatch.weight >= 2);
  return {
    niche: true,
    regions: regions.length ? regions : ["global"],
    topics,
    actors,
    companies,
    weight: dispatch.weight,
    whyItMatters: dispatch.whyItMatters,
    thread: keep ? thread : { kind: "none" },
  };
}

// OWASP LLM01, first layer: a title that talks to the model never reaches it. In a batch one
// hostile title could also sway its four neighbours, so it is kept out before batching.
const INJECTION = [
  /\b(ignore|disregard|forget)\b[^.]{0,40}\b(instructions?|prompts?|rules)\b/i,
  /\bsystem\s*:/i,
  /\bassistant\s*:/i,
  /\brules for the (assistant|model|AI)\b/i,
];

export const looksLikeInjection = (title: string) => INJECTION.some((pattern) => pattern.test(title));

// A title that talks to the model is treated as off the Niche: saved, shown nowhere.
export const QUARANTINED: OffNiche = OFF_NICHE;
