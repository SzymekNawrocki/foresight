import type { TokenUsage } from "../llm/llm.js";

// Groq free plan: 200K tokens/day per model (console.groq.com/docs/rate-limits). ~25% stays free
// for manual runs and evals (ADR 0009).
export const DAILY_TOKEN_LIMITS = {
  "openai/gpt-oss-20b": 150_000,
  "openai/gpt-oss-120b": 150_000,
} as const;

/** Daily token counters per model; `day` is a UTC date like 2026-10-19. */
export interface BudgetStore {
  used(day: string, model: string): Promise<number>;
  /** Adds tokens to the counter and returns the new total. */
  add(day: string, model: string, tokens: number): Promise<number>;
}

export interface BudgetLine {
  model: string;
  used: number;
  limit: number;
}

export interface TokenBudget {
  /** True when `tokens` more still fit in today's limit for the model. Call before every LLM call. */
  reserve(model: string, tokens: number): Promise<boolean>;
  /** Counts what a call really spent. Call after every call that reports usage. */
  record(usage: TokenUsage): Promise<void>;
  /** Today's spend for every model with a limit. */
  report(): Promise<BudgetLine[]>;
}

export interface BudgetOptions {
  store: BudgetStore;
  /** Tokens per model per UTC day, kept below the free Groq limits (ADR 0009). */
  limits: Readonly<Record<string, number>>;
  now?: () => Date;
}

// Stopping before the limit beats waiting for a 429: the day's last calls are not wasted, and
// the margin stays free for manual runs. One worker runs at a time, so a counter read once per
// run and kept in memory is exact.
export function createTokenBudget({ store, limits, now = () => new Date() }: BudgetOptions): TokenBudget {
  const day = () => now().toISOString().slice(0, 10);
  const spent = new Map<string, number>();
  const usedToday = async (model: string) => {
    const key = `${day()}|${model}`;
    if (!spent.has(key)) spent.set(key, await store.used(day(), model));
    return spent.get(key) ?? 0;
  };

  return {
    async reserve(model, tokens) {
      const limit = limits[model];
      if (limit === undefined) return false;
      return (await usedToday(model)) + tokens <= limit;
    },
    async record({ model, tokens }) {
      spent.set(`${day()}|${model}`, await store.add(day(), model, tokens));
    },
    async report() {
      return Promise.all(
        Object.entries(limits).map(async ([model, limit]) => ({ model, used: await usedToday(model), limit })),
      );
    },
  };
}

export class InMemoryBudgetStore implements BudgetStore {
  readonly #counters = new Map<string, number>();

  async used(day: string, model: string) {
    return this.#counters.get(`${day}|${model}`) ?? 0;
  }

  async add(day: string, model: string, tokens: number) {
    const total = (await this.used(day, model)) + tokens;
    this.#counters.set(`${day}|${model}`, total);
    return total;
  }
}
