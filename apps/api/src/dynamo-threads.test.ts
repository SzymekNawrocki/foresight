import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoThreadDirectory } from "./dynamo-threads.js";

const ddb = mockClient(DynamoDBDocumentClient);
const directory = () => new DynamoThreadDirectory(ddb as unknown as DynamoDBDocumentClient, "threads");
const thread = (id: string, status: string) => ({
  pk: "THREADS",
  sk: id,
  id,
  name: "Wątek",
  status,
  createdAt: "2026-10-18T10:00:00.000Z",
  lastEventAt: "2026-10-21T09:00:00.000Z",
  eventCount: 1,
  newEvents: 0,
  newWeight: 0,
  regions: [],
});
const entry = {
  pk: "THREAD#bbbb0001",
  sk: "EVENT#2026-10-21T10:00:00.000Z#" + "a".repeat(32),
  eventId: "a".repeat(32),
  title: "Event",
  url: "https://www.bbc.com/news/a",
  source: "bbc-world",
  tier: "B",
  publishedAt: "2026-10-21T10:00:00.000Z",
  linkedAt: "2026-10-21T11:00:00.000Z",
  weight: 2,
  whyItMatters: "Ważne.",
  actors: [],
  regions: ["africa"],
};

describe("DynamoThreadDirectory.decide", () => {
  beforeEach(() => ddb.reset());

  it("accepts with a conditional update, so a second decision loses", async () => {
    ddb.on(GetCommand).resolves({ Item: thread("bbbb0001", "proposed") });
    ddb.on(UpdateCommand).rejectsOnce(new ConditionalCheckFailedException({ message: "x", $metadata: {} }));

    await expect(directory().decide("bbbb0001", { action: "accept", name: "Sudan" })).resolves.toBe("conflict");
    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toMatchObject({
      Key: { pk: "THREADS", sk: "bbbb0001" },
      ConditionExpression: "#status = :proposed",
      ExpressionAttributeValues: { ":status": "active", ":name": "Sudan" },
    });
  });

  it("closes the proposal before copying its timeline into the target", async () => {
    ddb.on(GetCommand, { Key: { pk: "THREADS", sk: "bbbb0001" } }).resolves({ Item: thread("bbbb0001", "proposed") });
    ddb.on(GetCommand, { Key: { pk: "THREADS", sk: "aaaa0001" } }).resolves({ Item: thread("aaaa0001", "active") });
    ddb.on(QueryCommand).resolves({ Items: [entry] });
    ddb.on(UpdateCommand).resolves({});
    ddb.on(PutCommand).resolves({});

    await expect(directory().decide("bbbb0001", { action: "merge", into: "aaaa0001" })).resolves.toBe("ok");
    const updates = ddb.commandCalls(UpdateCommand).map((c) => c.args[0].input);
    expect(updates[0]).toMatchObject({ Key: { sk: "bbbb0001" }, ExpressionAttributeValues: { ":status": "merged", ":mergedInto": "aaaa0001" } });
    expect(updates[1]).toMatchObject({ Key: { sk: "aaaa0001" }, ExpressionAttributeValues: { ":n": 1, ":newWeight": 2 } });
    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input.Item).toMatchObject({ pk: "THREAD#aaaa0001", eventId: "a".repeat(32) });
  });
});
