import { z } from "zod";

// Spółka (CONTEXT.md): a listed company or ETF from a fixed list, keyed by its ticker. Like
// Actors, the list is an allow-list enforced in code, so the model cannot invent a ticker.
// Draft from issue #65; the owner accepts it in the PR.
export const COMPANY_NAME = {
  // Defence and drones
  LMT: "Lockheed Martin",
  RTX: "RTX",
  NOC: "Northrop Grumman",
  GD: "General Dynamics",
  LHX: "L3Harris",
  AVAV: "AeroVironment",
  KTOS: "Kratos",
  PLTR: "Palantir",
  RHM: "Rheinmetall",
  "BA.": "BAE Systems",
  "SAAB-B": "Saab",
  HAG: "Hensoldt",
  LDO: "Leonardo",
  HO: "Thales",
  KOG: "Kongsberg",
  AIR: "Airbus",
  // Cyber
  PANW: "Palo Alto Networks",
  CRWD: "CrowdStrike",
  FTNT: "Fortinet",
  ZS: "Zscaler",
  S: "SentinelOne",
  CHKP: "Check Point",
  OKTA: "Okta",
  NET: "Cloudflare",
  // Space
  RKLB: "Rocket Lab",
  ASTS: "AST SpaceMobile",
  IRDM: "Iridium",
  ETL: "Eutelsat",
  SESG: "SES",
  PL: "Planet Labs",
  VSAT: "Viasat",
  // Chips
  NVDA: "Nvidia",
  TSM: "TSMC",
  ASML: "ASML",
  AMD: "AMD",
  INTC: "Intel",
  MU: "Micron",
  "005930": "Samsung Electronics",
  "0981": "SMIC",
  AMAT: "Applied Materials",
  IFX: "Infineon",
  // AI platforms
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  META: "Meta",
  AMZN: "Amazon",
  // ETFs
  ITA: "iShares U.S. Aerospace & Defense",
  DFNS: "VanEck Defense",
  CIBR: "First Trust Cybersecurity",
  SMH: "VanEck Semiconductor",
  UFO: "Procure Space",
  // Poland (GPW)
  CRI: "Creotech Instruments",
  ACP: "Asseco Poland",
} as const;

export const Company = z.enum(Object.keys(COMPANY_NAME) as [keyof typeof COMPANY_NAME, ...(keyof typeof COMPANY_NAME)[]]);
export type Company = z.infer<typeof Company>;

// Wpływ na Spółkę (CONTEXT.md): a qualitative call, never investment advice; up to 3 per Event.
export const CompanyImpact = z.strictObject({
  company: Company,
  direction: z.enum(["up", "down", "uncertain"]),
  mechanism: z.string().min(1).max(200).describe("Jedno zdanie po polsku: dlaczego cena może się ruszyć"),
});
export type CompanyImpact = z.infer<typeof CompanyImpact>;
