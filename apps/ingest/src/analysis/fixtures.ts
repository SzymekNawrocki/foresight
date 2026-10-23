import type { Analysis, AnalysisV2, LegacyAnalysis } from "@foresight/shared";

export const validAnalysis: Analysis = {
  niche: true,
  regions: ["europe", "russia-eurasia"],
  topics: ["cyber"],
  actors: ["russia", "poland"],
  companies: [{ company: "CRWD", direction: "up", mechanism: "Atak państwowej grupy na sieć energetyczną zwiększa popyt na ochronę." }],
  weight: 2,
  whyItMatters: "Rosyjska grupa APT uderza w polską sieć energetyczną, więc rośnie ryzyko dla infrastruktury NATO.",
  thread: { kind: "none" },
};

// The shape saved in slices 10–11 — still in the table and still readable.
export const analysisV2: AnalysisV2 = {
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

// The same Event as the model answers it: labels as plain strings, the niche flag as "yes".
export const validDispatch = { ...validAnalysis, niche: "yes" as const };
