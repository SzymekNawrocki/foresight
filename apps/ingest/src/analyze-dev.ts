// Local AI Analysis of the newest real Events: `pnpm --filter @foresight/ingest analyze`.
// The Groq key comes only from the environment, e.g. in PowerShell: $env:GROQ_API_KEY = "gsk_…"
import type { Analysis } from "@foresight/shared";
import { createPendingAnalysis } from "./analysis/pending.js";
import { createTokenBudget, DAILY_TOKEN_LIMITS, InMemoryBudgetStore } from "./budget/budget.js";
import { fetchFeed } from "./feed.js";
import { runIngest } from "./ingest.js";
import { createGroqLlm } from "./llm/groq.js";
import { SOURCES } from "./sources.js";
import { InMemoryEventStore } from "./store.js";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("Set GROQ_API_KEY first (it is never stored in the repo).");
  process.exit(1);
}
const count = Number(process.env.ANALYZE_COUNT ?? 3);

const store = new InMemoryEventStore();
await runIngest({ sources: SOURCES, fetchFeed: (url) => fetchFeed(url), store, now: () => new Date() });
const events = store.latest(count);
const done = new Map<string, Analysis>();

const analysis = createPendingAnalysis({
  queue: {
    pending: async (limit) => events.filter((e) => !done.has(e.id)).slice(0, limit),
    async saveAnalysis(eventId, result) {
      done.set(eventId, result);
      const event = events.find((e) => e.id === eventId);
      console.log(`\n[${event?.source}] ${event?.title}`);
      console.dir(result, { depth: null });
    },
    backlog: async () => events.length - done.size,
  },
  llm: async () => createGroqLlm({ apiKey }),
  limit: count,
});

const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits: DAILY_TOKEN_LIMITS });
console.log("\nReport:", await analysis.analyzePending(budget));
console.log("Tokens:", await budget.report());
