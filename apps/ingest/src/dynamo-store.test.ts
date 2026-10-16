import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoEventStore } from "./dynamo-store.js";

const ddb = mockClient(DynamoDBDocumentClient);
const store = () => new DynamoEventStore(ddb as unknown as DynamoDBDocumentClient, "events");
const event = {
  id: "0123456789abcdef0123456789abcdef",
  source: "bbc-world",
  title: "Title",
  url: "https://www.bbc.co.uk/news/articles/x1",
  publishedAt: "2026-10-12T16:44:07.000Z",
  fetchedAt: "2026-10-12T18:00:00.000Z",
};

describe("DynamoEventStore", () => {
  beforeEach(() => ddb.reset());

  it("writes the Event only if its id is not taken yet, marked as waiting for Analysis", async () => {
    ddb.on(PutCommand).resolves({});

    await expect(store().putIfAbsent(event)).resolves.toBe(true);
    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      Item: { ...event, kind: "EVENT", pending: "EVENT" },
      ConditionExpression: "attribute_not_exists(id)",
    });
  });

  it("returns false for an Event that already exists", async () => {
    ddb.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: "exists", $metadata: {} }));

    await expect(store().putIfAbsent(event)).resolves.toBe(false);
  });

  it("rethrows other errors", async () => {
    ddb.on(PutCommand).rejects(new Error("throttled"));

    await expect(store().putIfAbsent(event)).rejects.toThrow("throttled");
  });
});
