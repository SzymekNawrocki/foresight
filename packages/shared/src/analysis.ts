import { z } from "zod";
import { Event } from "./event.js";

// The AI Analysis of one Event (CONTEXT.md: Region, Temat, Waga, Scenariusz, Gałąź).
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

export const Analysis = z.strictObject({
  regions: z.array(Region).min(1).max(8),
  topics: z.array(Topic).max(8),
  weight: Weight,
  whyItMatters: z.string().min(1).max(400).describe("Dwa zdania po polsku"),
  scenario: Scenario,
});
export type Analysis = z.infer<typeof Analysis>;

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

export const analysisJsonSchema = toStrict(z.toJSONSchema(Analysis)) as Record<string, unknown>;

// An Event as the page sees it: the Analysis is absent until the LLM has processed the Event.
export const AnalyzedEvent = Event.extend({ analysis: Analysis.optional() });
export type AnalyzedEvent = z.infer<typeof AnalyzedEvent>;
