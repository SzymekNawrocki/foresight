import { describe, expect, it } from "vitest";
import { NOW, threadOf } from "./fixtures.js";
import { applySeed, planSeed, SEED_THREADS, type SeedThread } from "./seed.js";
import { InMemoryThreadStore } from "./store.js";

const seeds: SeedThread[] = [
  { name: "Wojna dronów: Rosja–Ukraina", regions: ["russia-eurasia", "europe"] },
  { name: "Starlink i alternatywy dla Ukrainy", regions: ["europe"], reuse: "1b890b15" },
];
const ids = () => {
  let n = 0;
  return () => `5eed000${++n}`;
};

describe("planSeed", () => {
  it("creates missing seed Threads as active, empty and not dormant", () => {
    const plan = planSeed([], seeds.slice(0, 1), NOW, ids());

    expect(plan.create).toEqual([
      {
        id: "5eed0001",
        name: "Wojna dronów: Rosja–Ukraina",
        status: "active",
        createdAt: NOW.toISOString(),
        lastEventAt: NOW.toISOString(),
        eventCount: 0,
        newEvents: 0,
        newWeight: 0,
        regions: ["russia-eurasia", "europe"],
      },
    ]);
  });

  it("renames the active Thread a seed reuses instead of creating a duplicate", () => {
    const plan = planSeed([threadOf("1b890b15", { name: "Ukraina – Starlink" })], seeds.slice(1), NOW, ids());

    expect(plan.create).toEqual([]);
    expect(plan.rename).toEqual([{ id: "1b890b15", name: "Starlink i alternatywy dla Ukrainy" }]);
  });

  it("creates the seed when the Thread it would reuse is gone or no longer active", () => {
    const plan = planSeed([threadOf("1b890b15", { status: "rejected" })], seeds.slice(1), NOW, ids());

    expect(plan.create.map((t) => t.name)).toEqual(["Starlink i alternatywy dla Ukrainy"]);
    expect(plan.rename).toEqual([]);
  });

  it("closes every other active Thread and rejects every open proposal — a clean start for the Niche", () => {
    const existing = [
      threadOf("1b890b15", { name: "Ukraina – Starlink" }),
      threadOf("0fe4ac4e", { name: "Napięcia morskie Chiny-USA" }),
      threadOf("aaaa0001", { status: "proposed" }),
      threadOf("aaaa0002", { status: "rejected" }),
      threadOf("aaaa0003", { status: "merged" }),
    ];

    const plan = planSeed(existing, seeds, NOW, ids());

    expect(plan.close).toEqual(["0fe4ac4e"]);
    expect(plan.reject).toEqual(["aaaa0001"]);
  });

  it("does nothing the second time — a seed already active by name counts as done", () => {
    const first = planSeed([threadOf("1b890b15")], seeds, NOW, ids());
    const after = [
      threadOf("1b890b15", { name: "Starlink i alternatywy dla Ukrainy" }),
      ...first.create,
    ];

    expect(planSeed(after, seeds, NOW, ids())).toEqual({ create: [], rename: [], close: [], reject: [] });
  });
});

describe("applySeed", () => {
  it("writes the plan, closing and rejecting only Threads still in the status it saw", async () => {
    const store = new InMemoryThreadStore([
      threadOf("1b890b15", { name: "Ukraina – Starlink" }),
      threadOf("0fe4ac4e"),
      threadOf("aaaa0001", { status: "proposed" }),
    ]);
    const plan = planSeed(await store.list(), seeds, NOW, ids());
    // The owner accepts the proposal in the browser between the plan and the write.
    store.threads.set("aaaa0001", threadOf("aaaa0001", { status: "active" }));

    await expect(applySeed(store, plan)).resolves.toEqual({ created: 1, renamed: 1, closed: 1, rejected: 0, conflicts: 1 });
    expect(store.threads.get("1b890b15")?.name).toBe("Starlink i alternatywy dla Ukrainy");
    expect(store.threads.get("0fe4ac4e")?.status).toBe("rejected");
    expect(store.threads.get("aaaa0001")?.status).toBe("active");
    expect(store.threads.get("5eed0001")).toMatchObject({ status: "active", name: "Wojna dronów: Rosja–Ukraina" });
  });
});

describe("SEED_THREADS", () => {
  it("lists the 8 seed Threads accepted in #65, with valid regions and Polish names that fit a Thread", () => {
    expect(SEED_THREADS).toHaveLength(8);
    expect(SEED_THREADS.filter((s) => s.reuse).map((s) => s.reuse)).toEqual(["1b890b15"]);
    for (const seed of SEED_THREADS) {
      expect(seed.name.length).toBeLessThanOrEqual(80);
      expect(seed.regions.length).toBeGreaterThan(0);
    }
  });
});
