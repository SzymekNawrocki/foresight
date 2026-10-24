import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoThreadStore } from "./dynamo-threads.js";
import { entryOf, reportOf, threadOf } from "./fixtures.js";

const ddb = mockClient(DynamoDBDocumentClient);
const store = () => new DynamoThreadStore(ddb as unknown as DynamoDBDocumentClient, "threads");

describe("DynamoThreadStore", () => {
  beforeEach(() => ddb.reset());

  it("reads the list of Threads from the THREADS partition, skipping items that break the contract", async () => {
    const thread = threadOf("aaaa0001");
    ddb.on(QueryCommand).resolves({ Items: [{ pk: "THREADS", sk: thread.id, ...thread }, { pk: "THREADS", sk: "x", name: 1 }] });

    await expect(store().list()).resolves.toEqual([thread]);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({ ExpressionAttributeValues: { ":pk": "THREADS" } });
  });

  it("writes a timeline entry under THREAD#<id> and bumps counters without touching the status", async () => {
    ddb.on(PutCommand).resolves({});
    ddb.on(UpdateCommand).resolves({});
    const entry = entryOf("a");

    await store().link("aaaa0001", entry, { lastEventAt: entry.publishedAt, newWeight: 2, regions: ["europe"] });

    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input.Item).toMatchObject({
      pk: "THREAD#aaaa0001",
      sk: `EVENT#${entry.publishedAt}#${entry.eventId}`,
    });
    const update = ddb.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(update?.Key).toEqual({ pk: "THREADS", sk: "aaaa0001" });
    expect(update?.UpdateExpression).not.toContain("status");
    expect(update?.UpdateExpression).toContain("ADD #eventCount :one, #newEvents :one");
  });

  it("keeps every report version and reads back the newest", async () => {
    const report = reportOf();
    ddb.on(PutCommand).resolves({});
    ddb.on(UpdateCommand).resolves({});
    ddb.on(QueryCommand).resolves({ Items: [{ pk: "THREAD#aaaa0001", sk: `REPORT#${report.createdAt}`, ...report }] });

    await store().saveReport("aaaa0001", report, { lead: { scenario: "S", likelihood: "prawdopodobne", change: "new" }, moves: [] });

    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input.Item).toMatchObject({ sk: `REPORT#${report.createdAt}` });
    await expect(store().latestReport("aaaa0001")).resolves.toEqual(report);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({ ScanIndexForward: false, Limit: 1 });
  });

  it("changes a Thread's name or status only while it still has the status the owner saw", async () => {
    ddb.on(UpdateCommand).resolves({});

    await expect(store().update("aaaa0001", { status: "rejected" }, "proposed")).resolves.toBe(true);
    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toEqual({
      TableName: "threads",
      Key: { pk: "THREADS", sk: "aaaa0001" },
      UpdateExpression: "SET #status = :status",
      ConditionExpression: "#status = :expected",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":expected": "proposed", ":status": "rejected" },
    });
  });

  it("reports a conflict when the status changed meanwhile", async () => {
    ddb.on(UpdateCommand).rejects(new ConditionalCheckFailedException({ message: "no", $metadata: {} }));

    await expect(store().update("aaaa0001", { name: "Nowa nazwa" }, "active")).resolves.toBe(false);
    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toMatchObject({
      UpdateExpression: "SET #name = :name",
      ExpressionAttributeNames: { "#status": "status", "#name": "name" },
    });
  });
});
