import { type DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { Analysis, type AnalyzedEvent, Event } from "@foresight/shared";
import type { EventReader } from "./events.js";

// Most of the stream is off the Niche, so the newest N Events are read a few times over; a hard
// cap keeps a quiet Niche from draining the index's 5 RCU (each item is ~1 KB).
const OVERREAD = 3;
const READ_MAX = 300;

// Data model: docs/data-model.md → "Latest N Events". The web role may Query only this index.
export class DynamoEventReader implements EventReader {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  latest(limit: number) {
    return this.#collect("#kind = :kind", { ":kind": "EVENT" }, limit, limit * OVERREAD, READ_MAX);
  }

  since(since: string, max: number) {
    return this.#collect("#kind = :kind AND publishedAt >= :since", { ":kind": "EVENT", ":since": since }, max, max, max);
  }

  // Pages newest first until `want` Events in the Niche are found or `readMax` items were read.
  async #collect(condition: string, values: Record<string, string>, want: number, pageSize: number, readMax: number) {
    const events: AnalyzedEvent[] = [];
    let read = 0;
    let startKey: QueryCommandInput["ExclusiveStartKey"];
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "latest",
          KeyConditionExpression: condition,
          ExpressionAttributeNames: { "#kind": "kind" },
          ExpressionAttributeValues: values,
          ScanIndexForward: false,
          Limit: Math.min(pageSize, readMax - read),
          ExclusiveStartKey: startKey,
        }),
      );
      const items = page.Items ?? [];
      read += items.length;
      events.push(...items.flatMap(toNicheEvent));
      startKey = page.LastEvaluatedKey;
    } while (startKey && events.length < want && read < readMax);
    return events.slice(0, want);
  }
}

// Items came from feeds and the LLM (untrusted): only what still matches the contract reaches
// the page. Only an Event with a valid Analysis in the Niche is shown (ADR 0010) — not one off
// the Niche, still pending, analysed before the Niche existed, or with a broken Analysis.
function toNicheEvent(item: Record<string, unknown>): AnalyzedEvent[] {
  const event = Event.safeParse(item);
  const analysis = Analysis.safeParse(item.analysis);
  return event.success && analysis.success ? [{ ...event.data, analysis: analysis.data }] : [];
}
