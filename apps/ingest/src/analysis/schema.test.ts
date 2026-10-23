import { ACTOR_REGION, Actor, Analysis, analysisJsonSchema, AnalysisV2, AnalyzedEvent, LegacyAnalysis, Verdict } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { analysisV2, legacyAnalysis, validAnalysis } from "./fixtures.js";

describe("Analysis", () => {
  it("accepts a complete Analysis", () => {
    expect(Analysis.safeParse(validAnalysis).success).toBe(true);
  });

  it.each([
    ["attach", { kind: "attach", threadId: "hormuz" }],
    ["propose", { kind: "propose", name: "Blokada Cieśniny Ormuz" }],
  ])("accepts the thread decision %s", (_, thread) => {
    expect(Analysis.safeParse({ ...validAnalysis, thread }).success).toBe(true);
  });

  it.each([
    ["no Region", { ...validAnalysis, regions: [] }],
    ["unknown Region", { ...validAnalysis, regions: ["atlantis"] }],
    ["unknown Topic", { ...validAnalysis, topics: ["crypto"] }],
    ["unknown Actor", { ...validAnalysis, actors: ["atlantis"] }],
    ["more than 4 Actors", { ...validAnalysis, actors: ["usa", "china", "iran", "israel", "russia"] }],
    ["Weight out of range", { ...validAnalysis, weight: 4 }],
    ["fractional Weight", { ...validAnalysis, weight: 1.5 }],
    ["empty why-it-matters", { ...validAnalysis, whyItMatters: "" }],
    ["oversized why-it-matters", { ...validAnalysis, whyItMatters: "x".repeat(301) }],
    ["attach without a Thread id", { ...validAnalysis, thread: { kind: "attach" } }],
    ["unknown thread decision", { ...validAnalysis, thread: { kind: "merge", threadId: "x" } }],
    ["per-Event Scenario", { ...validAnalysis, scenario: legacyAnalysis.scenario }],
    ["extra field", { ...validAnalysis, html: "<script>" }],
  ])("rejects %s", (_, candidate) => {
    expect(Analysis.safeParse(candidate).success).toBe(false);
  });

  it("allows a niche Event with no Actor and no Company", () => {
    expect(Analysis.safeParse({ ...validAnalysis, actors: [], companies: [], weight: 1 }).success).toBe(true);
  });

  it.each([
    ["no Topic", { ...validAnalysis, topics: [] }],
    ["a v2 Topic", { ...validAnalysis, topics: ["energy"] }],
    ["an unknown Company", { ...validAnalysis, companies: [{ company: "ANDURIL", direction: "up", mechanism: "Kontrakt." }] }],
    ["more than 3 Companies", { ...validAnalysis, companies: Array(4).fill(validAnalysis.companies[0]) }],
    ["an unknown direction", { ...validAnalysis, companies: [{ company: "LMT", direction: "sideways", mechanism: "Kontrakt." }] }],
    ["no niche flag", { ...validAnalysis, niche: undefined }],
  ])("rejects a niche Analysis with %s", (_, candidate) => {
    expect(Analysis.safeParse(candidate).success).toBe(false);
  });

  it("saves an Event off the Niche as the bare flag, and nothing else", () => {
    expect(Verdict.safeParse({ niche: false }).success).toBe(true);
    expect(Verdict.safeParse({ niche: false, topics: [] }).success).toBe(false);
  });

  it("maps Actors only to Regions that exist", () => {
    for (const [actor, region] of Object.entries(ACTOR_REGION)) {
      expect(Actor.options).toContain(actor);
      expect(Analysis.shape.regions.element.options).toContain(region);
    }
  });
});

describe("reading stored Analyses", () => {
  const event = {
    id: "0123456789abcdef0123456789abcdef",
    source: "oilprice",
    title: "Hormuz",
    url: "https://oilprice.com/1",
    publishedAt: "2026-10-16T10:00:00.000Z",
    fetchedAt: "2026-10-16T11:00:00.000Z",
  };

  it("still reads the legacy shape with a per-Event Scenario", () => {
    expect(LegacyAnalysis.safeParse(legacyAnalysis).success).toBe(true);
    expect(AnalyzedEvent.parse({ ...event, analysis: legacyAnalysis }).analysis).toEqual(legacyAnalysis);
  });

  it("still reads the v2 shape with the old Topics", () => {
    expect(AnalysisV2.safeParse(analysisV2).success).toBe(true);
    expect(AnalyzedEvent.parse({ ...event, analysis: analysisV2 }).analysis).toEqual(analysisV2);
  });

  it("reads the current shape", () => {
    expect(AnalyzedEvent.parse({ ...event, analysis: validAnalysis }).analysis).toEqual(validAnalysis);
  });

  it("does not show an Event off the Niche as analyzed", () => {
    expect(AnalyzedEvent.safeParse({ ...event, analysis: { niche: false } }).success).toBe(false);
  });
});

describe("analysisJsonSchema (Groq strict mode)", () => {
  const objects: Record<string, unknown>[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (record.type === "object") objects.push(record);
      Object.values(record).forEach(walk);
    }
  };
  walk(analysisJsonSchema);

  it("closes every object and marks every property required", () => {
    expect(objects.length).toBeGreaterThanOrEqual(4);
    for (const object of objects) {
      expect(object.additionalProperties).toBe(false);
      expect(object.required).toEqual(Object.keys(object.properties as object));
    }
  });

  it("uses only keywords Groq documents for strict mode", () => {
    const allowed = new Set(["type", "properties", "required", "additionalProperties", "items", "enum", "anyOf", "description"]);
    const used = new Set<string>();
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          used.add(key);
          if (key === "properties") Object.values(value as object).forEach(collect);
          else collect(value);
        }
      }
    };
    collect(analysisJsonSchema);
    expect([...used].filter((key) => !allowed.has(key))).toEqual([]);
  });

  it("lists the same Regions, Topics and Actors as the Zod schema", () => {
    const props = (analysisJsonSchema as { properties: Record<string, { items: { enum: string[] } }> }).properties;
    expect(props.regions?.items.enum).toEqual(Analysis.shape.regions.element.options);
    expect(props.topics?.items.enum).toEqual(Analysis.shape.topics.element.options);
    expect(props.actors?.items.enum).toEqual(Actor.options);
  });

  it("keeps the thread decision kinds as enums, not const", () => {
    expect(JSON.stringify(analysisJsonSchema)).toContain('"enum":["attach"]');
  });
});
