import { describe, expect, it } from "vitest";
import { createTokenBudget, InMemoryBudgetStore } from "./budget.js";

const SMALL = "openai/gpt-oss-20b";
const LARGE = "openai/gpt-oss-120b";
const limits = { [SMALL]: 10_000, [LARGE]: 5_000 };
const at = (iso: string) => () => new Date(iso);

describe("createTokenBudget", () => {
  it("allows a call that fits in today's limit", async () => {
    const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits, now: at("2026-10-19T10:00:00Z") });

    await expect(budget.reserve(SMALL, 10_000)).resolves.toBe(true);
  });

  it("refuses a call that would cross the limit, counting what was already spent today", async () => {
    const store = new InMemoryBudgetStore();
    const budget = createTokenBudget({ store, limits, now: at("2026-10-19T10:00:00Z") });

    await budget.record({ model: SMALL, tokens: 8_000 });

    await expect(budget.reserve(SMALL, 2_000)).resolves.toBe(true);
    await expect(budget.reserve(SMALL, 2_001)).resolves.toBe(false);
  });

  it("keeps a separate limit per model", async () => {
    const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits, now: at("2026-10-19T10:00:00Z") });

    await budget.record({ model: SMALL, tokens: 9_000 });

    await expect(budget.reserve(LARGE, 5_000)).resolves.toBe(true);
  });

  it("refuses a model without a limit", async () => {
    const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits, now: at("2026-10-19T10:00:00Z") });

    await expect(budget.reserve("some/other-model", 1)).resolves.toBe(false);
  });

  it("starts from zero on a new UTC day", async () => {
    const store = new InMemoryBudgetStore();
    await createTokenBudget({ store, limits, now: at("2026-10-19T23:59:00Z") }).record({ model: SMALL, tokens: 10_000 });

    const tomorrow = createTokenBudget({ store, limits, now: at("2026-10-20T00:01:00Z") });

    await expect(tomorrow.reserve(SMALL, 10_000)).resolves.toBe(true);
  });

  it("sees what an earlier run spent the same day", async () => {
    const store = new InMemoryBudgetStore();
    await createTokenBudget({ store, limits, now: at("2026-10-19T09:00:00Z") }).record({ model: SMALL, tokens: 9_500 });

    const laterRun = createTokenBudget({ store, limits, now: at("2026-10-19T10:00:00Z") });

    await expect(laterRun.reserve(SMALL, 1_000)).resolves.toBe(false);
  });

  it("reports today's spend for every model", async () => {
    const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits, now: at("2026-10-19T10:00:00Z") });

    await budget.record({ model: SMALL, tokens: 1_200 });
    await budget.record({ model: SMALL, tokens: 800 });

    await expect(budget.report()).resolves.toEqual([
      { model: SMALL, used: 2_000, limit: 10_000 },
      { model: LARGE, used: 0, limit: 5_000 },
    ]);
  });
});
