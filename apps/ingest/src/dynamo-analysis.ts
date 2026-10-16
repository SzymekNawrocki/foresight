import { type DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { type Analysis, Event } from "@foresight/shared";
import type { AnalysisQueue } from "./analysis/analyzer.js";

// Data model: docs/data-model.md → "Events waiting for Analysis". Only new Events carry
// `pending`, so the index holds exactly the queue and costs nothing once it is drained.
export class DynamoAnalysisQueue implements AnalysisQueue {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async pending(limit: number) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "pending",
        KeyConditionExpression: "#pending = :pending",
        ExpressionAttributeNames: { "#pending": "pending" },
        ExpressionAttributeValues: { ":pending": "EVENT" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items.flatMap((item) => {
      const parsed = Event.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async saveAnalysis(eventId: string, analysis: Analysis) {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { id: eventId },
        UpdateExpression: "SET #analysis = :analysis REMOVE #pending",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: { "#analysis": "analysis", "#pending": "pending" },
        ExpressionAttributeValues: { ":analysis": analysis },
      }),
    );
  }
}
