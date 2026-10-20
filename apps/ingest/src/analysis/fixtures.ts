import type { Analysis, LegacyAnalysis } from "@foresight/shared";

export const validAnalysis: Analysis = {
  regions: ["middle-east"],
  topics: ["energy", "sanctions-trade"],
  actors: ["iran"],
  weight: 2,
  whyItMatters: "Cieśnina Ormuz to wąskie gardło dla jednej piątej ropy, więc każde zakłócenie od razu trafia w ceny.",
  thread: { kind: "none" },
};

// The shape saved before slice 10 — still in the table and still shown on the page.
export const legacyAnalysis: LegacyAnalysis = {
  regions: ["middle-east"],
  topics: ["energy", "sanctions-trade"],
  weight: 2,
  whyItMatters: "Cieśnina Ormuz to wąskie gardło dla jednej piątej ropy. Każde zakłócenie od razu trafia w ceny.",
  scenario: {
    escalation: { path: "Blokada cieśniny na kilka dni.", assetClass: "ropa", direction: "up" },
    deescalation: { path: "Rozmowy dyplomatyczne uspokajają rynek.", assetClass: "ropa", direction: "down" },
  },
};
