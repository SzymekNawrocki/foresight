import { type DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Analysis, type AnalyzedEvent, Event } from "@foresight/shared";
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
    // Items came from feeds and the LLM (untrusted): only what still matches the contract reaches
    // the page. A broken Analysis is dropped on its own, so the Event still shows.
    return Items.flatMap((item): AnalyzedEvent[] => {
      const event = Event.safeParse(item);
      if (!event.success) return [];
      const analysis = Analysis.safeParse(item.analysis);
      return [analysis.success ? { ...event.data, analysis: analysis.data } : event.data];
    });
  }
}
