// Local AI Analysis of the newest real Events: `pnpm --filter @foresight/ingest analyze`.
// The Groq key comes only from the environment, e.g. in PowerShell: $env:GROQ_API_KEY = "gsk_…"
import { analyzeBatch } from "./analysis/batch.js";
import { createGroqAnalyzer } from "./analysis/groq.js";
import { fetchFeed } from "./feed.js";
import { runIngest } from "./ingest.js";
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

const report = await analyzeBatch({
  events,
  analyzer: createGroqAnalyzer({ apiKey }),
  store: {
    async saveAnalysis(eventId, analysis) {
      const event = events.find((e) => e.id === eventId);
      console.log(`\n[${event?.source}] ${event?.title}`);
      console.dir(analysis, { depth: null });
    },
  },
  limit: count,
});

console.log("\nReport:", report);
