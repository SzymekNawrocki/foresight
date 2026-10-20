import { ACTOR_REGION, Analysis, type Region } from "@foresight/shared";
import { z } from "zod";

// The model answers for a whole batch; each dispatch names its Event by position, never by id,
// so nothing from our table goes to the model.
export const BATCH_SIZE = 5;
export const REFS = ["e1", "e2", "e3", "e4", "e5"] as const;

const Dispatch = Analysis.extend({ ref: z.enum(REFS) });

// One invalid dispatch (say, a sentence over the limit) turns into null instead of failing the
// whole answer, so only its own Event stays pending. `catch` leaves the JSON schema sent to the
// model unchanged, which is why the null is cast in rather than declared with `nullable`.
export const DispatchBatch = z.strictObject({
  dispatches: z.array(Dispatch.catch(null as unknown as z.infer<typeof Dispatch>)).max(BATCH_SIZE),
});
export type DispatchBatch = z.infer<typeof DispatchBatch>;

// What the model may not decide on its own (ADR 0009: rules live in code, not in the prompt):
// an Actor always brings its home Region, an attach must name a Thread we actually sent, and
// only a significant Event may propose a New situation. Fields are copied one by one, so
// nothing else the answer carries (such as its ref) is saved.
export function settle(dispatch: Analysis, activeThreadIds: ReadonlySet<string>): Analysis {
  const homes = dispatch.actors.flatMap((actor): Region[] => {
    const home = ACTOR_REGION[actor];
    return home ? [home] : [];
  });
  const regions = [...new Set([...dispatch.regions, ...homes])].slice(0, 8);
  const { thread } = dispatch;
  const keep =
    (thread.kind === "attach" && activeThreadIds.has(thread.threadId)) || (thread.kind === "propose" && dispatch.weight >= 2);
  return {
    regions,
    topics: dispatch.topics,
    actors: dispatch.actors,
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

export const QUARANTINED: Analysis = {
  regions: ["global"],
  topics: [],
  actors: [],
  weight: 1,
  whyItMatters: "Tytuł zawiera polecenia dla modelu, więc pominięto go jako możliwą manipulację.",
  thread: { kind: "none" },
};
