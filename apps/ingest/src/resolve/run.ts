import type { Instrument, Thesis } from "@foresight/shared";
import { planResolution, type Resolution } from "./resolve.js";
import type { PriceSource } from "./tiingo.js";

export interface OpenThesis {
  owner: string;
  thesis: Thesis;
}

export interface ThesisResolutionStore {
  open(): Promise<OpenThesis[]>;
  update(owner: string, id: string, resolution: Resolution): Promise<void>;
}

export interface ResolveReport {
  open: number;
  updated: number;
  resolved: number;
  errors: string[];
}

const needsPrice = (t: Thesis, now: Date) => t.entryPrice === undefined || t.resolveAt <= now.toISOString();

// Daily run: one price request per Instrument that has something due (≤ 20 a day, far below
// Tiingo's free limits). One failing Instrument never stops the others.
export async function runResolve({ store, prices, now }: { store: ThesisResolutionStore; prices: PriceSource; now: () => Date }) {
  const today = now();
  const open = await store.open();
  const report: ResolveReport = { open: open.length, updated: 0, resolved: 0, errors: [] };

  const byInstrument = new Map<Instrument, OpenThesis[]>();
  for (const item of open) {
    if (!needsPrice(item.thesis, today)) continue;
    byInstrument.set(item.thesis.instrument, [...(byInstrument.get(item.thesis.instrument) ?? []), item]);
  }

  for (const [instrument, due] of byInstrument) {
    try {
      const from = due.map(({ thesis }) => thesis.createdAt.slice(0, 10)).sort()[0] ?? today.toISOString().slice(0, 10);
      const closes = await prices.closes(instrument, from, today.toISOString().slice(0, 10));
      for (const { owner, thesis } of due) {
        const resolution = planResolution(thesis, closes, today);
        if (!resolution) continue;
        await store.update(owner, thesis.id, resolution);
        report.updated++;
        if (resolution.status === "resolved") report.resolved++;
      }
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return report;
}
