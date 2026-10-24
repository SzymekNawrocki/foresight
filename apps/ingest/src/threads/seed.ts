import type { Region, Thread } from "@foresight/shared";
import type { ThreadStore } from "./store.js";

/** A Thread the Niche starts with; `reuse` names an active Thread to rename instead of a new one. */
export interface SeedThread {
  name: string;
  regions: Region[];
  reuse?: string;
}

// Accepted by the owner in #65. "Ukraina – Starlink" already has 9 dispatches, so it is renamed.
export const SEED_THREADS: SeedThread[] = [
  { name: "Wojna dronów: Rosja–Ukraina", regions: ["russia-eurasia", "europe"] },
  { name: "Uderzenia w rosyjskie rafinerie i energetykę", regions: ["russia-eurasia"] },
  { name: "Starlink i alternatywy dla Ukrainy", regions: ["europe", "russia-eurasia", "north-america"], reuse: "1b890b15" },
  { name: "Kontrola eksportu chipów USA–Chiny", regions: ["north-america", "asia-pacific"] },
  { name: "Tajwan i TSMC", regions: ["asia-pacific"] },
  { name: "Ataki państwowych grup APT na infrastrukturę", regions: ["global"] },
  { name: "Wyścig zbrojeń w Europie (kontrakty i zakupy)", regions: ["europe"] },
  { name: "Militaryzacja kosmosu (USA, Chiny, Rosja)", regions: ["global"] },
];

export interface SeedPlan {
  create: Thread[];
  rename: { id: string; name: string }[];
  /** Active Threads outside the seed: closed (status rejected), timeline kept. */
  close: string[];
  /** Open proposals from before the Niche: rejected in bulk. */
  reject: string[];
}

// A clean start for the Niche (ADR 0010): only the seed Threads stay active, every other active
// Thread is closed and every open proposal rejected. A seed already active under its name counts
// as done, so a second run plans nothing.
export function planSeed(threads: Thread[], seeds: SeedThread[], now: Date, newId: () => string): SeedPlan {
  const active = threads.filter((t) => t.status === "active");
  const kept = new Set<string>();
  const plan: SeedPlan = { create: [], rename: [], close: [], reject: [] };

  for (const seed of seeds) {
    const byName = active.find((t) => t.name === seed.name);
    const reused = active.find((t) => t.id === seed.reuse);
    if (byName) {
      kept.add(byName.id);
    } else if (reused) {
      kept.add(reused.id);
      plan.rename.push({ id: reused.id, name: seed.name });
    } else {
      const at = now.toISOString();
      plan.create.push({
        id: newId(),
        name: seed.name,
        status: "active",
        createdAt: at,
        lastEventAt: at,
        eventCount: 0,
        newEvents: 0,
        newWeight: 0,
        regions: seed.regions,
      });
    }
  }

  plan.close = active.filter((t) => !kept.has(t.id)).map((t) => t.id);
  plan.reject = threads.filter((t) => t.status === "proposed").map((t) => t.id);
  return plan;
}

export interface SeedReport {
  created: number;
  renamed: number;
  closed: number;
  rejected: number;
  /** Threads whose status changed between the plan and the write (e.g. accepted meanwhile). */
  conflicts: number;
}

export async function applySeed(store: ThreadStore, plan: SeedPlan): Promise<SeedReport> {
  const report: SeedReport = { created: 0, renamed: 0, closed: 0, rejected: 0, conflicts: 0 };
  const count = (ok: boolean, key: Exclude<keyof SeedReport, "created" | "conflicts">) => {
    report[ok ? key : "conflicts"] += 1;
  };

  for (const thread of plan.create) {
    await store.create(thread);
    report.created += 1;
  }
  for (const { id, name } of plan.rename) count(await store.update(id, { name }, "active"), "renamed");
  for (const id of plan.close) count(await store.update(id, { status: "rejected" }, "active"), "closed");
  for (const id of plan.reject) count(await store.update(id, { status: "rejected" }, "proposed"), "rejected");
  return report;
}
