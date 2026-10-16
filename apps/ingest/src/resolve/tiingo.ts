import type { Instrument } from "@foresight/shared";
import { z } from "zod";
import type { DailyClose } from "./resolve.js";

export interface PriceSource {
  /** Daily closes of one Instrument between two days (inclusive, YYYY-MM-DD). */
  closes(instrument: Instrument, from: string, to: string): Promise<DailyClose[]>;
}

const Row = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}/), close: z.number().positive() });

// Tiingo end-of-day prices (free Starter plan: personal use, 50 requests/hour, 1000/day).
// The key goes in a header, so it never lands in URLs or access logs. The answer is external
// input: every row is validated, anything else is dropped.
export function createTiingoPrices({
  apiKey,
  fetch = globalThis.fetch,
  timeoutMs = 10_000,
}: {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}): PriceSource {
  return {
    async closes(instrument, from, to) {
      const url = `https://api.tiingo.com/tiingo/daily/${instrument}/prices?startDate=${from}&endDate=${to}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { authorization: `Token ${apiKey}`, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Tiingo ${instrument}: HTTP ${res.status}`);
      const body: unknown = await res.json();
      return (Array.isArray(body) ? body : []).flatMap((raw) => {
        const row = Row.safeParse(raw);
        return row.success ? [{ date: row.data.date.slice(0, 10), close: row.data.close }] : [];
      });
    },
  };
}
