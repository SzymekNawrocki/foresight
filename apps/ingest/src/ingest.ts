import { toEvent } from "./event.js";
import { parseFeed } from "./feed.js";
import type { Source } from "./sources.js";
import type { EventStore } from "./store.js";

export interface SourceReport {
  source: string;
  items: number;
  new: number;
  duplicate: number;
  invalid: number;
  error?: string;
}

export interface IngestInput {
  sources: readonly Source[];
  fetchFeed: (url: string) => Promise<string>;
  store: EventStore;
  now: () => Date;
}

// One Source failing (down, malformed, too big) never stops the others.
export async function runIngest({ sources, fetchFeed, store, now }: IngestInput): Promise<SourceReport[]> {
  return Promise.all(
    sources.map(async (source) => {
      const report: SourceReport = { source: source.id, items: 0, new: 0, duplicate: 0, invalid: 0 };
      try {
        const items = parseFeed(await fetchFeed(source.url));
        report.items = items.length;
        const fetchedAt = now();

        for (const item of items) {
          const event = toEvent(item, source.id, fetchedAt);
          if (!event) report.invalid++;
          else if (await store.putIfAbsent(event)) report.new++;
          else report.duplicate++;
        }
      } catch (error) {
        report.error = error instanceof Error ? error.message : String(error);
      }
      return report;
    }),
  );
}
