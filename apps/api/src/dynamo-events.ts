import { type DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Event } from "@foresight/shared";
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
    // Items came from feeds (untrusted): only what still matches the contract reaches the page.
    return Items.flatMap((item) => {
      const parsed = Event.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }
}
