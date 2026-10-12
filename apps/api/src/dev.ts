// Lokalny serwer deweloperski. Na AWS ten sam `createApi` obsługuje adapter Lambdy (lambda.ts).
import { serve } from "@hono/node-server";
import { createApi } from "./app.js";
import { InMemoryEventReader } from "./events.js";

const port = 8787;

const sample = [
  {
    id: "0".repeat(32),
    source: "bbc-world",
    title: "Sample Event — local dev server, no DynamoDB",
    url: "https://example.com/",
    publishedAt: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
  },
];

serve({ fetch: createApi({ events: new InMemoryEventReader(sample) }).fetch, port }, () => {
  console.log(`API: http://localhost:${port}/api/health`);
});
