import { Analysis, analysisJsonSchema } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { validAnalysis } from "./fixtures.js";

describe("Analysis", () => {
  it("accepts a complete Analysis", () => {
    expect(Analysis.safeParse(validAnalysis).success).toBe(true);
  });

  it.each([
    ["no Region", { ...validAnalysis, regions: [] }],
    ["unknown Region", { ...validAnalysis, regions: ["atlantis"] }],
    ["unknown Topic", { ...validAnalysis, topics: ["crypto"] }],
    ["Weight out of range", { ...validAnalysis, weight: 4 }],
    ["fractional Weight", { ...validAnalysis, weight: 1.5 }],
    ["empty why-it-matters", { ...validAnalysis, whyItMatters: "" }],
    ["oversized why-it-matters", { ...validAnalysis, whyItMatters: "x".repeat(401) }],
    ["missing Branch", { ...validAnalysis, scenario: { escalation: validAnalysis.scenario.escalation } }],
    ["extra field", { ...validAnalysis, html: "<script>" }],
  ])("rejects %s", (_, candidate) => {
    expect(Analysis.safeParse(candidate).success).toBe(false);
  });

  it("allows an Event with no Topic (noise)", () => {
    expect(Analysis.safeParse({ ...validAnalysis, topics: [], weight: 1 }).success).toBe(true);
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

  it("lists the same Regions and Topics as the Zod schema", () => {
    const props = (analysisJsonSchema as { properties: Record<string, { items: { enum: string[] } }> }).properties;
    expect(props.regions?.items.enum).toEqual(Analysis.shape.regions.element.options);
    expect(props.topics?.items.enum).toEqual(Analysis.shape.topics.element.options);
  });
});
