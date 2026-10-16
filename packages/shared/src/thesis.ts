import { z } from "zod";
import { Region, Topic } from "./analysis.js";

// Instrument (CONTEXT.md): a short list of US-listed ETFs, so one end-of-day price source covers
// all of them — commodities included (e.g. BNO tracks Brent).
export const INSTRUMENTS = {
  SOXX: "Półprzewodniki (SOXX)",
  ITA: "Zbrojeniówka USA (ITA)",
  CIBR: "Cyberbezpieczeństwo (CIBR)",
  BOTZ: "AI i robotyka (BOTZ)",
  UFO: "Kosmos (UFO)",
  XLE: "Energia USA (XLE)",
  BNO: "Ropa Brent (BNO)",
  UNG: "Gaz ziemny USA (UNG)",
  URA: "Uran (URA)",
  GLD: "Złoto (GLD)",
  SLV: "Srebro (SLV)",
  CPER: "Miedź (CPER)",
  LIT: "Lit i baterie (LIT)",
  SPY: "S&P 500 (SPY)",
  QQQ: "Nasdaq 100 (QQQ)",
  EEM: "Rynki wschodzące (EEM)",
  FXI: "Chiny (FXI)",
  EPOL: "Polska (EPOL)",
  TLT: "Obligacje USA 20+ (TLT)",
  UUP: "Dolar amerykański (UUP)",
} as const;

export const Instrument = z.enum(Object.keys(INSTRUMENTS) as [keyof typeof INSTRUMENTS, ...(keyof typeof INSTRUMENTS)[]]);
export type Instrument = z.infer<typeof Instrument>;

/** Kierunek: wzrost, spadek albo bez zmian (ruch w granicach ±2%). */
export const Direction = z.enum(["up", "down", "flat"]);
export type Direction = z.infer<typeof Direction>;

/** Horyzont w dniach. */
export const Horizon = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export type Horizon = z.infer<typeof Horizon>;

// What the owner sends. Everything else (Regions, Topics, dates) the server derives itself.
export const NewThesis = z.strictObject({
  eventId: z.string().regex(/^[a-f0-9]{32}$/),
  instrument: Instrument,
  direction: Direction,
  horizonDays: Horizon,
  rationale: z.string().trim().min(10).max(1000),
});
export type NewThesis = z.infer<typeof NewThesis>;

export const Thesis = NewThesis.extend({
  id: z.string().regex(/^[0-9TZ:.-]{24}#[a-f0-9]{8}$/),
  eventTitle: z.string().min(1).max(300),
  regions: z.array(Region).max(8),
  topics: z.array(Topic).max(8),
  createdAt: z.iso.datetime(),
  resolveAt: z.iso.datetime(),
  status: z.enum(["open", "resolved"]),
  // Rozstrzygnięcie (slice 07) — filled in by the resolver.
  entryPrice: z.number().positive().optional(),
  exitPrice: z.number().positive().optional(),
  actual: Direction.optional(),
  hit: z.boolean().optional(),
  resolvedAt: z.iso.datetime().optional(),
});
export type Thesis = z.infer<typeof Thesis>;

export const ThesesResponse = z.object({ theses: z.array(Thesis).max(1000) });
export type ThesesResponse = z.infer<typeof ThesesResponse>;

// GET /api/config — public values the page needs to start the login (no secrets).
export const ConfigResponse = z.object({
  auth: z.object({ domain: z.url({ protocol: /^https$/ }), clientId: z.string().min(1).max(128) }).nullable(),
});
export type ConfigResponse = z.infer<typeof ConfigResponse>;
