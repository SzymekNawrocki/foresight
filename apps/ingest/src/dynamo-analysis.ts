import { type DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Event, Verdict } from "@foresight/shared";
import type { RecentAnalysis } from "./analysis/duplicate.js";
import type { AnalysisQueue } from "./analysis/queue.js";

// Data model: docs/data-model.md → "Events waiting for Analysis". Only new Events carry
// `pending`, so the index holds exactly the queue and costs nothing once it is drained.
// Its value is the Source tier; `EVENT` marks Events queued before tiers existed (slice 10).
const QUEUE_ORDER = ["A", "B", "EVENT", "C"] as const;

export class DynamoAnalysisQueue implements AnalysisQueue {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  // Tier A and B first, so facts are analyzed before interpretation when the queue is long.
  async pending(limit: number) {
    const events: Event[] = [];
    for (const tier of QUEUE_ORDER) {
      if (events.length >= limit) break;
      const { Items = [] } = await this.client.send(
        new QueryCommand({
          ...this.#inTier(tier),
          ScanIndexForward: false,
          Limit: limit - events.length,
        }),
      );
      for (const item of Items) {
        const parsed = Event.safeParse(item);
        if (parsed.success) events.push(parsed.data);
      }
    }
    return events;
  }

  async saveAnalysis(eventId: string, analysis: Verdict) {
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
    for (const tier of QUEUE_ORDER) {
      let start: Record<string, unknown> | undefined;
      do {
        const res = await this.client.send(
          new QueryCommand({ ...this.#inTier(tier), Select: "COUNT", ...(start && { ExclusiveStartKey: start }) }),
        );
        count += res.Count ?? 0;
        start = res.LastEvaluatedKey;
      } while (start);
    }
    return count;
  }

  // ~400 Events in 48 h read as ~40 RCU once an hour — within the burst of the `latest` index.
  // Only a v3 Verdict is reused; older shapes have no niche flag or Companies.
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
        const analysis = Verdict.safeParse(item.analysis);
        if (typeof item.title === "string" && analysis.success) found.push({ title: item.title, analysis: analysis.data });
      }
      start = res.LastEvaluatedKey;
    } while (start);
    return found;
  }

  #inTier(tier: string) {
    return {
      TableName: this.tableName,
      IndexName: "pending",
      KeyConditionExpression: "#pending = :pending",
      ExpressionAttributeNames: { "#pending": "pending" },
      ExpressionAttributeValues: { ":pending": tier },
    };
  }
}
