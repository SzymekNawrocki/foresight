// One real Situation report for a hand-made Thread: `pnpm --filter @foresight/ingest report`.
// Checks that Groq accepts the report schema and that settleReport() keeps it (~7K tokens).
// The Groq key comes only from the environment, e.g. in PowerShell: $env:GROQ_API_KEY = "gsk_…"
import { createTokenBudget, DAILY_TOKEN_LIMITS, InMemoryBudgetStore, REPORT_LANE } from "./budget/budget.js";
import { createGroqLlm } from "./llm/groq.js";
import { createSituationReports } from "./reports/refresh.js";
import { entryOf, threadOf } from "./threads/fixtures.js";
import { InMemoryThreadStore } from "./threads/store.js";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("Set GROQ_API_KEY first (it is never stored in the repo).");
  process.exit(1);
}

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
const store = new InMemoryThreadStore(
  [threadOf("aaaa0001", { name: "Cieśnina Ormuz", lastEventAt: hoursAgo(1), newEvents: 3, newWeight: 3 })],
  {
    aaaa0001: [
      entryOf("a", {
        title: "Iran seizes oil tanker near the Strait of Hormuz",
        tier: "B",
        publishedAt: hoursAgo(5),
        linkedAt: hoursAgo(4),
        whyItMatters: "Zajęcie tankowca podnosi ryzyko dla dostaw ropy przez cieśninę.",
      }),
      entryOf("b", {
        title: "Pentagon announces naval escorts for commercial shipping in the Gulf",
        source: "us-dod",
        tier: "A",
        publishedAt: hoursAgo(3),
        linkedAt: hoursAgo(2),
        whyItMatters: "Eskorty USA zwiększają ryzyko starcia, ale chronią żeglugę.",
      }),
      entryOf("c", {
        title: "Analysts warn a Hormuz closure could push Brent above $120",
        source: "oilprice",
        tier: "C",
        publishedAt: hoursAgo(2),
        linkedAt: hoursAgo(1),
        whyItMatters: "Rynek wycenia ryzyko blokady.",
      }),
    ],
  },
);

const reports = createSituationReports({ store, llm: async () => createGroqLlm({ apiKey }), lane: REPORT_LANE, now: () => now });
const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits: DAILY_TOKEN_LIMITS });

console.log(JSON.stringify(await reports.refreshDue(budget)));
console.log(JSON.stringify(await budget.report()));
console.log(JSON.stringify(store.reports.get("aaaa0001")?.[0] ?? null, null, 2));
