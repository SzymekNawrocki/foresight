import { describe, expect, it } from "vitest";
import { findDuplicate, isNearDuplicate } from "./duplicate.js";
import { validAnalysis } from "./fixtures.js";

// Real pairs from the events table, 18–20 October 2026 (379 Events in 48 h).
describe("isNearDuplicate", () => {
  it.each([
    [
      "Anthropic says it will commit 5% of its shares to 'public benefit fund'",
      "Anthropic says it will commit 5% of shares to ‘public benefit’ fund",
    ],
    ["Exiled critic of Rwandan president found beheaded", "Exiled critic of Rwandan president found beheaded in Uganda"],
    ["Qatar to unveil regional defence partnership", "Qatar to announce a new regional defence partnership"],
    [
      "UK to deploy Typhoon jets to help defend Saudi Arabia from Houthi attacks",
      "UK to deploy fighter jets to defend Saudi cities from Houthi attacks",
    ],
    [
      "Australian Member of Parliament critically injured after being hit by a car",
      "Australian MP critically injured after being hit by car in apparent attack",
    ],
    [
      "Flight from Israel makes emergency landing in Bulgaria after bomb threat",
      "Threat forces Israel to Austria flight into emergency landing",
    ],
  ])("matches a reworded headline: %s", (a, b) => {
    expect(isNearDuplicate(a, b)).toBe(true);
  });

  it.each([
    // Same wording, different news: a daily market line and a follow-up of a story.
    [
      "Treasury yields move lower as investors assess U.S. inflation backdrop",
      "U.S. Treasury yields move lower as investors await housing, employment data",
    ],
    [
      "Australian MP Helen Haines critically injured in ‘deliberate’ car ramming",
      "‘Deliberate’ car ramming of Australian MP an isolated incident, police say",
    ],
    ["Trump says he'd meet with Putin and Xi, criticizes Zelenskyy", "Zelenskyy to meet with U.S. envoy as tensions with Trump mount"],
  ])("keeps apart different news with shared words: %s", (a, b) => {
    expect(isNearDuplicate(a, b)).toBe(false);
  });

  it("never matches titles that differ in a number", () => {
    expect(isNearDuplicate("Iraq's October Oil Exports Top 3.4 Million Bpd", "Iraq's October Oil Exports Top 3.2 Million Bpd")).toBe(false);
    expect(isNearDuplicate("Kenya convicts cult leader over 191 murders", "Kenya convicts cult leader over 190 murders")).toBe(false);
  });

  it("never matches titles that move in opposite directions", () => {
    expect(isNearDuplicate("Treasury yields move higher as inflation cools", "Treasury yields move lower as inflation cools")).toBe(false);
    expect(isNearDuplicate("Oil prices rise on Red Sea attacks", "Oil prices fall on Red Sea attacks")).toBe(false);
  });

  it("does not match very short titles on one or two words", () => {
    expect(isNearDuplicate("Albania’s protests explained", "Albania protests")).toBe(false);
  });
});

describe("findDuplicate", () => {
  const recent = [
    { title: "Qatar to unveil regional defence partnership", analysis: { ...validAnalysis, weight: 3 as const } },
    { title: "Oil prices rise on Red Sea attacks", analysis: validAnalysis },
  ];

  it("returns the Analysis of the closest recent Event", () => {
    expect(findDuplicate("Qatar to announce a new regional defence partnership", recent)).toEqual({ ...validAnalysis, weight: 3 });
  });

  it("returns nothing for a new story", () => {
    expect(findDuplicate("Japan’s Electricity Prices Surge 25% as LNG and Coal Costs Soar", recent)).toBeUndefined();
  });
});
