// Local run against the real feeds, in-memory store: `pnpm --filter @foresight/ingest dev`.
import { fetchFeed } from "./feed.js";
import { runIngest } from "./ingest.js";
import { SOURCES } from "./sources.js";
import { InMemoryEventStore } from "./store.js";

const store = new InMemoryEventStore();
const input = { sources: SOURCES, fetchFeed: (url: string) => fetchFeed(url), store, now: () => new Date() };

console.log("Run 1:");
console.table(await runIngest(input));
console.log("Run 2 (same feeds — everything should be a duplicate):");
console.table(await runIngest(input));
