import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { type DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SituationReport, Thread, type ThreadStatus, type TimelineEntry, TimelineEntry as TimelineEntrySchema, threadKeys } from "@foresight/shared";
import type { LinkPatch, ReportSummary, ThreadChange, ThreadStore } from "./store.js";

// Data model: docs/data-model.md → "threads table". The list of Threads is one partition
// (`THREADS`), each Thread's timeline and report versions another (`THREAD#<id>`).
export class DynamoThreadStore implements ThreadStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async list() {
    const threads: Thread[] = [];
    let start: Record<string, unknown> | undefined;
    do {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": threadKeys.list },
          ...(start && { ExclusiveStartKey: start }),
        }),
      );
      for (const item of res.Items ?? []) {
        const parsed = Thread.safeParse(item);
        if (parsed.success) threads.push(parsed.data);
      }
      start = res.LastEvaluatedKey;
    } while (start);
    return threads;
  }

  async create(thread: Thread) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: threadKeys.list, sk: thread.id, ...thread },
        ConditionExpression: "attribute_not_exists(pk)",
      }),
    );
  }

  async link(threadId: string, entry: TimelineEntry, patch: LinkPatch) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: threadKeys.thread(threadId), sk: threadKeys.entry(entry), ...entry },
      }),
    );
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: threadKeys.list, sk: threadId },
        UpdateExpression:
          "SET #lastEventAt = :lastEventAt, #newWeight = :newWeight, #regions = :regions ADD #eventCount :one, #newEvents :one",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: names("lastEventAt", "newWeight", "regions", "eventCount", "newEvents"),
        ExpressionAttributeValues: {
          ":lastEventAt": patch.lastEventAt,
          ":newWeight": patch.newWeight,
          ":regions": patch.regions,
          ":one": 1,
        },
      }),
    );
  }

  async timeline(threadId: string, limit: number) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": threadKeys.thread(threadId), ":prefix": "EVENT#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items.flatMap((item) => {
      const parsed = TimelineEntrySchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  async latestReport(threadId: string) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": threadKeys.thread(threadId), ":prefix": "REPORT#" },
        ScanIndexForward: false,
        Limit: 1,
      }),
    );
    const parsed = SituationReport.safeParse(Items[0]);
    return parsed.success ? parsed.data : null;
  }

  async saveReport(threadId: string, report: SituationReport, summary: ReportSummary) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { pk: threadKeys.thread(threadId), sk: threadKeys.report(report.createdAt), ...report },
      }),
    );
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: threadKeys.list, sk: threadId },
        UpdateExpression: "SET #reportedAt = :at, #lead = :lead, #moves = :moves, #newEvents = :zero, #newWeight = :zero",
        ConditionExpression: "attribute_exists(pk)",
        ExpressionAttributeNames: names("reportedAt", "lead", "moves", "newEvents", "newWeight"),
        ExpressionAttributeValues: { ":at": report.createdAt, ":lead": summary.lead, ":moves": summary.moves, ":zero": 0 },
      }),
    );
  }
  // Only the owner's seed command calls this; the worker never changes a status or a name.
  async update(threadId: string, change: ThreadChange, expected: ThreadStatus): Promise<boolean> {
    const fields = Object.entries(change).filter(([, value]) => value !== undefined);
    if (fields.length === 0) return true;
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: threadKeys.list, sk: threadId },
          UpdateExpression: `SET ${fields.map(([name]) => `#${name} = :${name}`).join(", ")}`,
          ConditionExpression: "#status = :expected",
          ExpressionAttributeNames: names("status", ...fields.map(([name]) => name).filter((n) => n !== "status")),
          ExpressionAttributeValues: { ":expected": expected, ...Object.fromEntries(fields.map(([name, value]) => [`:${name}`, value])) },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
}

/** Placeholders for attribute names, so none can collide with a DynamoDB reserved word. */
const names = (...attributes: string[]) => Object.fromEntries(attributes.map((a) => [`#${a}`, a]));
