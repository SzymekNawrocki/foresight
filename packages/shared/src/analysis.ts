import { z } from "zod";
import { Event } from "./event.js";

// The AI Analysis of one Event (CONTEXT.md: Region, Temat, Aktor, Waga, Wątek).
// The answer comes from an LLM that reads untrusted feed titles, so every field is bounded
// and unknown fields are rejected.

export const Region = z.enum([
  "north-america",
  "latin-america",
  "europe",
  "russia-eurasia",
  "middle-east",
  "africa",
  "asia-pacific",
  "global",
]);
export type Region = z.infer<typeof Region>;

export const Topic = z.enum([
  "cyber",
  "ai",
  "battlefield",
  "space",
  "semiconductors",
  "commodities",
  "energy",
  "sanctions-trade",
]);
export type Topic = z.infer<typeof Topic>;

export const Weight = z.int().min(1).max(3).describe("1 = szum, 2 = istotne, 3 = przełomowe");
export type Weight = z.infer<typeof Weight>;

export const Branch = z.strictObject({
  path: z.string().min(1).max(300).describe("Jedno zdanie: jak rozwija się sytuacja"),
  assetClass: z.string().min(1).max(60).describe("Klasa aktywów, np. ropa, złoto, półprzewodniki"),
  direction: z.enum(["up", "down"]),
});
export type Branch = z.infer<typeof Branch>;

export const Scenario = z.strictObject({
  escalation: Branch,
  deescalation: Branch,
});
export type Scenario = z.infer<typeof Scenario>;

// Aktor (CONTEXT.md): a state or organisation from a fixed list; up to 4 per Event.
export const Actor = z.enum([
  "usa",
  "canada",
  "mexico",
  "brazil",
  "venezuela",
  "uk",
  "germany",
  "france",
  "italy",
  "poland",
  "ukraine",
  "russia",
  "belarus",
  "turkey",
  "israel",
  "palestine",
  "iran",
  "iraq",
  "syria",
  "saudi-arabia",
  "uae",
  "qatar",
  "egypt",
  "india",
  "pakistan",
  "afghanistan",
  "china",
  "taiwan",
  "japan",
  "south-korea",
  "north-korea",
  "australia",
  "eu",
  "nato",
  "un",
  "opec",
  "g7",
  "brics",
  "african-union",
  "hamas",
  "hezbollah",
  "houthis",
]);
export type Actor = z.infer<typeof Actor>;

// The Region an Actor always brings with it. The worker adds it in code, so an Event about Iran
// is in the Middle East even when the model forgot. Organisations without one home are left out.
export const ACTOR_REGION: Partial<Record<Actor, Region>> = {
  usa: "north-america",
  canada: "north-america",
  mexico: "latin-america",
  brazil: "latin-america",
  venezuela: "latin-america",
  uk: "europe",
  germany: "europe",
  france: "europe",
  italy: "europe",
  poland: "europe",
  eu: "europe",
  ukraine: "russia-eurasia",
  russia: "russia-eurasia",
  belarus: "russia-eurasia",
  israel: "middle-east",
  palestine: "middle-east",
  iran: "middle-east",
  iraq: "middle-east",
  syria: "middle-east",
  "saudi-arabia": "middle-east",
  uae: "middle-east",
  qatar: "middle-east",
  egypt: "middle-east",
  hamas: "middle-east",
  hezbollah: "middle-east",
  houthis: "middle-east",
  india: "asia-pacific",
  pakistan: "asia-pacific",
  china: "asia-pacific",
  taiwan: "asia-pacific",
  japan: "asia-pacific",
  "south-korea": "asia-pacific",
  "north-korea": "asia-pacific",
  australia: "asia-pacific",
  "african-union": "africa",
};

// Groq strict mode has no "const", so each kind is a one-value enum.
export const ThreadDecision = z.union([
  z.strictObject({ kind: z.enum(["attach"]), threadId: z.string().min(1).max(64).describe("id aktywnego Wątku z listy") }),
  z.strictObject({ kind: z.enum(["propose"]), name: z.string().min(1).max(80).describe("Krótka nazwa Nowej sytuacji") }),
  z.strictObject({ kind: z.enum(["none"]) }),
]);
export type ThreadDecision = z.infer<typeof ThreadDecision>;

// Analysis v2 — a lean dispatch (ADR 0009). Scenarios moved to the Situation report of a Thread.
export const Analysis = z.strictObject({
  regions: z.array(Region).min(1).max(8),
  topics: z.array(Topic).max(8),
  actors: z.array(Actor).max(4),
  weight: Weight,
  whyItMatters: z.string().min(1).max(300).describe("Jedno zdanie po polsku"),
  thread: ThreadDecision,
});
export type Analysis = z.infer<typeof Analysis>;

// The shape saved before slice 10. Never written again, only read, until those Events age out.
export const LegacyAnalysis = z.strictObject({
  regions: z.array(Region).min(1).max(8),
  topics: z.array(Topic).max(8),
  weight: Weight,
  whyItMatters: z.string().min(1).max(400),
  scenario: Scenario,
});
export type LegacyAnalysis = z.infer<typeof LegacyAnalysis>;

/** Any Analysis that may be in the table: the reader accepts both shapes. */
export const StoredAnalysis = z.union([Analysis, LegacyAnalysis]);
export type StoredAnalysis = z.infer<typeof StoredAnalysis>;

// Groq strict mode documents only types, enums, anyOf, required and closed objects, so length
// and range limits are dropped here and enforced by Zod on the answer instead.
const STRICT_KEYWORDS = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "anyOf", "description"]);

function toStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrict);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!STRICT_KEYWORDS.has(key)) continue;
    out[key] =
      key === "properties"
        ? Object.fromEntries(Object.entries(value as object).map(([name, child]) => [name, toStrict(child)]))
        : toStrict(value);
  }
  return out;
}

/** JSON Schema of a Zod schema in the subset Groq strict mode accepts. */
export const strictJsonSchema = (schema: z.ZodType) => toStrict(z.toJSONSchema(schema)) as Record<string, unknown>;

export const analysisJsonSchema = strictJsonSchema(Analysis);

// An Event as the page sees it: the Analysis is absent until the LLM has processed the Event.
export const AnalyzedEvent = Event.extend({ analysis: StoredAnalysis.optional() });
export type AnalyzedEvent = z.infer<typeof AnalyzedEvent>;
