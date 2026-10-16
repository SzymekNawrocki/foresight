import type { Direction, Thesis } from "@foresight/shared";

// Rozstrzygnięcie (CONTEXT.md): the price of the Instrument when the Thesis was placed vs. after
// the Horizon. A move within ±2% counts as "no change".

export interface DailyClose {
  /** Trading day, YYYY-MM-DD (US market). */
  date: string;
  close: number;
}

export type Resolution = Partial<Pick<Thesis, "entryPrice" | "exitPrice" | "actual" | "hit" | "status" | "resolvedAt">>;

const FLAT_BAND = 0.02;
// The US market closes at 16:00 New York = 20:00 UTC in summer, 21:00 UTC in winter. Anything
// placed from 20:00 UTC on counts from the next trading day, so a Thesis can never use a close
// that was already known when it was written.
const CLOSE_CUTOFF_UTC_HOUR = 20;

export function firstCloseAfter(closes: readonly DailyClose[], instant: string): DailyClose | null {
  const at = new Date(instant);
  const day = instant.slice(0, 10);
  const from = at.getUTCHours() >= CLOSE_CUTOFF_UTC_HOUR ? nextDay(day) : day;
  return closes.toSorted((a, b) => a.date.localeCompare(b.date)).find((c) => c.date >= from) ?? null;
}

const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

export function judge(entry: number, exit: number): Direction {
  // A difference, not a ratio: 102 / 100 - 1 is 0.020000000000000018 in floating point, which
  // would turn an exact 2% move into "up".
  const band = entry * FLAT_BAND;
  if (exit - entry > band) return "up";
  if (entry - exit > band) return "down";
  return "flat";
}

/** What to write to an open Thesis today, or null when there is nothing to do yet. */
export function planResolution(thesis: Thesis, closes: readonly DailyClose[], now: Date): Resolution | null {
  if (thesis.status !== "open") return null;

  const entryPrice = thesis.entryPrice ?? firstCloseAfter(closes, thesis.createdAt)?.close;
  if (entryPrice === undefined) return null;

  if (thesis.resolveAt > now.toISOString()) return thesis.entryPrice === undefined ? { entryPrice } : null;

  const exit = firstCloseAfter(closes, thesis.resolveAt);
  if (!exit) return thesis.entryPrice === undefined ? { entryPrice } : null;

  const actual = judge(entryPrice, exit.close);
  return {
    entryPrice,
    exitPrice: exit.close,
    actual,
    hit: actual === thesis.direction,
    status: "resolved",
    resolvedAt: now.toISOString(),
  };
}
