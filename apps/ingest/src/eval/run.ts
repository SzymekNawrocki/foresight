// `pnpm eval` — runs the golden cases through the real Analysis module and Groq.
// Run it before and after a prompt change and put both scores in the PR (ADR 0009).
// The key comes only from the environment, e.g. in PowerShell: $env:GROQ_API_KEY = "gsk_…"
import { createHash } from "node:crypto";
import type { Event, Verdict } from "@foresight/shared";
import { createPendingAnalysis } from "../analysis/pending.js";
import { createTokenBudget, DAILY_TOKEN_LIMITS, InMemoryBudgetStore } from "../budget/budget.js";
import { createGroqLlm } from "../llm/groq.js";
import { CASES } from "./cases.js";
import { fromVerdict, scoreCase } from "./score.js";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("Set GROQ_API_KEY first (it is never stored in the repo).");
  process.exit(1);
}

const now = new Date().toISOString();
const events: Event[] = CASES.map((c) => ({
  id: createHash("sha256").update(c.title).digest("hex").slice(0, 32),
  source: c.source,
  title: c.title,
  url: "https://example.com/eval",
  publishedAt: now,
  fetchedAt: now,
}));
const results = new Map<string, Verdict>();

// A failed call says why only in Groq's message; each distinct one is printed once.
const httpErrors = new Set<string>();
const onHttpError = (status: number, message: string) => {
  const line = `Groq ${status}: ${message.slice(0, 500)}`;
  if (!httpErrors.has(line)) console.error(line);
  httpErrors.add(line);
};

const analysis = createPendingAnalysis({
  queue: {
    pending: async (limit) => events.filter((e) => !results.has(e.id)).slice(0, limit),
    saveAnalysis: async (eventId, result) => void results.set(eventId, result),
    backlog: async () => events.length - results.size,
    // Every case must reach the model, so nothing counts as a near-duplicate here.
    recent: async () => [],
  },
  llm: async () => createGroqLlm({ apiKey, onHttpError }),
  limit: events.length,
});

const budget = createTokenBudget({ store: new InMemoryBudgetStore(), limits: DAILY_TOKEN_LIMITS });
const report = await analysis.analyzePending(budget);

const scores = CASES.map((c, i) => {
  const analysis = results.get(events[i]?.id ?? "");
  return scoreCase(c, analysis && fromVerdict(analysis));
});
for (const s of scores) {
  console.log(`${s.passed === s.total ? "PASS" : "FAIL"} ${s.passed}/${s.total}  ${s.title}`);
  for (const miss of s.misses) console.log(`       - ${miss}`);
}
const passed = scores.reduce((sum, s) => sum + s.passed, 0);
const total = scores.reduce((sum, s) => sum + s.total, 0);
const tokens = (await budget.report()).find((line) => line.used > 0)?.used ?? 0;
console.log(`\nChecks: ${passed}/${total} · cases fully right: ${scores.filter((s) => s.passed === s.total).length}/${scores.length}`);
// The niche gate on its own: a lost niche Event costs more than noise let in (ADR 0010).
const lost = CASES.filter((c, i) => c.niche && scores[i]?.misses.some((m) => m.startsWith("niche") || m === "no dispatch")).length;
const leaked = CASES.filter((c, i) => !c.niche && scores[i]?.passed === 0).length;
const nicheCount = CASES.filter((c) => c.niche).length;
console.log(`Niche gate: lost ${lost}/${nicheCount} niche · let in ${leaked}/${CASES.length - nicheCount} off-niche`);
console.log(`Tokens: ${tokens} (${Math.round(tokens / events.length)} per Event) · run report: ${JSON.stringify(report)}`);
