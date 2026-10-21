import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { type DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { type ProposalDecision, SituationReport, Thread, TimelineEntry, threadKeys } from "@foresight/shared";
import { type DecisionResult, mergeInto, TIMELINE_LIMIT, type ThreadDirectory } from "./threads.js";

// Data model: docs/data-model.md → "threads table". The web role may touch only the THREADS
// and THREAD#<id> partitions (dynamodb:LeadingKeys), never the token counters.
export class DynamoThreadDirectory implements ThreadDirectory {
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
      threads.push(...(res.Items ?? []).flatMap(parse(Thread)));
      start = res.LastEvaluatedKey;
    } while (start);
    return threads;
  }

  async get(id: string) {
    const thread = await this.#thread(id);
    if (!thread) return null;
    const [timeline, reports] = await Promise.all([this.#partition(id, "EVENT#", TIMELINE_LIMIT), this.#partition(id, "REPORT#", 1)]);
    return {
      thread,
      report: reports.flatMap(parse(SituationReport))[0] ?? null,
      timeline: timeline.flatMap(parse(TimelineEntry)),
    };
  }

  async proposals() {
    const proposed = (await this.list()).filter((t) => t.status === "proposed");
    return Promise.all(
      proposed.map(async (thread) => ({ thread, timeline: (await this.#partition(thread.id, "EVENT#", 20)).flatMap(parse(TimelineEntry)) })),
    );
  }

  async decide(id: string, decision: ProposalDecision): Promise<DecisionResult> {
    const proposal = await this.#thread(id);
    if (!proposal) return "not-found";
    if (proposal.status !== "proposed") return "conflict";

    if (decision.action === "merge") {
      const target = await this.#thread(decision.into);
      if (!target) return "not-found";
      if (target.status !== "active") return "conflict";
      const moved = (await this.#partition(id, "EVENT#", TIMELINE_LIMIT)).flatMap(parse(TimelineEntry));
      // The proposal is closed first, so a second click cannot copy the timeline twice.
      if (!(await this.#close(id, "merged", { mergedInto: target.id }))) return "conflict";
      for (const entry of moved) {
        await this.client.send(
          new PutCommand({ TableName: this.tableName, Item: { pk: threadKeys.thread(target.id), sk: threadKeys.entry(entry), ...entry } }),
        );
      }
      const merged = mergeInto(target, moved);
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: threadKeys.list, sk: target.id },
          UpdateExpression:
            "SET #lastEventAt = :lastEventAt, #newWeight = :newWeight, #regions = :regions ADD #eventCount :n, #newEvents :n",
          ExpressionAttributeNames: Object.fromEntries(
            ["lastEventAt", "newWeight", "regions", "eventCount", "newEvents"].map((a) => [`#${a}`, a]),
          ),
          ExpressionAttributeValues: {
            ":lastEventAt": merged.lastEventAt,
            ":newWeight": merged.newWeight,
            ":regions": merged.regions,
            ":n": moved.length,
          },
        }),
      );
      return "ok";
    }

    const status = decision.action === "accept" ? "active" : "rejected";
    const rename = decision.action === "accept" && decision.name ? { name: decision.name } : {};
    return (await this.#close(id, status, rename)) ? "ok" : "conflict";
  }

  /** Moves a proposal out of `proposed` — conditional, so only one decision ever lands. */
  async #close(id: string, status: Thread["status"], fields: Record<string, string>) {
    const sets = Object.keys(fields).map((name) => `#${name} = :${name}`);
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pk: threadKeys.list, sk: id },
          UpdateExpression: `SET #status = :status${sets.map((s) => `, ${s}`).join("")}`,
          ConditionExpression: "#status = :proposed",
          ExpressionAttributeNames: { "#status": "status", ...Object.fromEntries(Object.keys(fields).map((n) => [`#${n}`, n])) },
          ExpressionAttributeValues: {
            ":status": status,
            ":proposed": "proposed",
            ...Object.fromEntries(Object.entries(fields).map(([n, v]) => [`:${n}`, v])),
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }

  async #thread(id: string) {
    const { Item } = await this.client.send(new GetCommand({ TableName: this.tableName, Key: { pk: threadKeys.list, sk: id } }));
    const parsed = Thread.safeParse(Item);
    return parsed.success ? parsed.data : null;
  }

  async #partition(id: string, prefix: "EVENT#" | "REPORT#", limit: number) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: { ":pk": threadKeys.thread(id), ":prefix": prefix },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return Items;
  }
}

// Items were written from LLM answers (untrusted): only what still matches the contract is served.
const parse =
  <T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }) =>
  (item: unknown): T[] => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  };
