import { type DynamoDBDocumentClient, GetCommand, QueryCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { Analysis, type AnalyzedEvent, Event } from "@foresight/shared";
import type { EventReader } from "./events.js";

// Data model: docs/data-model.md → "Latest N Events" (Query on the index) and "One Event"
// (GetItem, when a Thesis is placed). No Scan, no writes.
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

  async get(id: string) {
    const { Item } = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { id } }));
    return Item ? (toAnalyzedEvent(Item)[0] ?? null) : null;
  }
}

// Items came from feeds and the LLM (untrusted): only what still matches the contract reaches
// the page. A broken Analysis is dropped on its own, so the Event still shows.
function toAnalyzedEvent(item: Record<string, unknown>): AnalyzedEvent[] {
  const event = Event.safeParse(item);
  if (!event.success) return [];
  const analysis = Analysis.safeParse(item.analysis);
  return [analysis.success ? { ...event.data, analysis: analysis.data } : event.data];
}
