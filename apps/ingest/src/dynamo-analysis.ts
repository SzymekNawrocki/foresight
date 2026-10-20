import { type DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Analysis, Event } from "@foresight/shared";
import type { RecentAnalysis } from "./analysis/duplicate.js";
import type { AnalysisQueue } from "./analysis/queue.js";

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

  async backlog() {
    let count = 0;
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "pending",
          KeyConditionExpression: "#pending = :pending",
          ExpressionAttributeNames: { "#pending": "pending" },
          ExpressionAttributeValues: { ":pending": "EVENT" },
          Select: "COUNT",
          ...(start && { ExclusiveStartKey: start }),
        }),
      );
      count += res.Count ?? 0;
      start = res.LastEvaluatedKey;
    } while (start);
    return count;
  }

  // ~400 Events in 48 h read as ~40 RCU once an hour — within the burst of the `latest` index.
  // Only the current Analysis shape is reused; a legacy one has no Actors or Thread decision.
  async recent(since: string) {
    const found: RecentAnalysis[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: "latest",
          KeyConditionExpression: "#kind = :kind AND #publishedAt >= :since",
          FilterExpression: "attribute_exists(#analysis)",
          ProjectionExpression: "#title, #analysis",
          ExpressionAttributeNames: { "#kind": "kind", "#publishedAt": "publishedAt", "#analysis": "analysis", "#title": "title" },
          ExpressionAttributeValues: { ":kind": "EVENT", ":since": since },
          ...(start && { ExclusiveStartKey: start }),
        }),
      );
      for (const item of res.Items ?? []) {
        const analysis = Analysis.safeParse(item.analysis);
        if (typeof item.title === "string" && analysis.success) found.push({ title: item.title, analysis: analysis.data });
      }
      start = res.LastEvaluatedKey;
    } while (start);
    return found;
  }
}
