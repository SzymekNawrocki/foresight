import { type DynamoDBDocumentClient, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { type AnalyzedEvent, Event, OffNiche, StoredAnalysis } from "@foresight/shared";
import type { EventReader } from "./events.js";

// Data model: docs/data-model.md → "Latest N Events". The web role may Query only this index.
export class DynamoEventReader implements EventReader {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async latest(limit: number) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "latest",
        KeyConditionExpression: "#kind = :kind",
        ExpressionAttributeNames: { "#kind": "kind" },
        ExpressionAttributeValues: { ":kind": "EVENT" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items.flatMap(toAnalyzedEvent);
  }

  async since(since: string, max: number) {
    const events: AnalyzedEvent[] = [];
    let startKey: QueryCommandInput["ExclusiveStartKey"];
    do {
      const page = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "latest",
          KeyConditionExpression: "#kind = :kind AND publishedAt >= :since",
          ExpressionAttributeNames: { "#kind": "kind" },
          ExpressionAttributeValues: { ":kind": "EVENT", ":since": since },
          ScanIndexForward: false,
          Limit: max - events.length,
          ExclusiveStartKey: startKey,
        }),
      );
      events.push(...(page.Items ?? []).flatMap(toAnalyzedEvent));
      startKey = page.LastEvaluatedKey;
    } while (startKey && events.length < max);
    return events;
  }
}

// Items came from feeds and the LLM (untrusted): only what still matches the contract reaches
// the page. A broken Analysis is dropped on its own, so the Event still shows. An Event off the
// Niche is shown nowhere (ADR 0010).
function toAnalyzedEvent(item: Record<string, unknown>): AnalyzedEvent[] {
  const event = Event.safeParse(item);
  if (!event.success || OffNiche.safeParse(item.analysis).success) return [];
  const analysis = StoredAnalysis.safeParse(item.analysis);
  return [analysis.success ? { ...event.data, analysis: analysis.data } : event.data];
}
