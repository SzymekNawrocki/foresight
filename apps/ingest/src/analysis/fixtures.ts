import type { Analysis } from "@foresight/shared";

export const validAnalysis: Analysis = {
  regions: ["middle-east"],
  topics: ["energy", "sanctions-trade"],
  weight: 2,
  whyItMatters: "Cieśnina Ormuz to wąskie gardło dla jednej piątej ropy. Każde zakłócenie od razu trafia w ceny.",
  scenario: {
    escalation: { path: "Blokada cieśniny na kilka dni.", assetClass: "ropa", direction: "up" },
    deescalation: { path: "Rozmowy dyplomatyczne uspokajają rynek.", assetClass: "ropa", direction: "down" },
  },
};
