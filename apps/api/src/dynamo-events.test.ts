import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoEventReader } from "./dynamo-events.js";

const ddb = mockClient(DynamoDBDocumentClient);
const reader = () => new DynamoEventReader(ddb as unknown as DynamoDBDocumentClient, "events");
const event = {
  id: "0123456789abcdef0123456789abcdef",
  source: "bbc-world",
  title: "Title",
  url: "https://www.bbc.co.uk/news/articles/x1",
  publishedAt: "2026-10-12T16:44:07.000Z",
  fetchedAt: "2026-10-12T18:00:00.000Z",
};

describe("DynamoEventReader", () => {
  beforeEach(() => ddb.reset());

  it("queries the `latest` index newest first, limited to N", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });

    await reader().latest(7);

    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      IndexName: "latest",
      KeyConditionExpression: "#kind = :kind",
      ExpressionAttributeNames: { "#kind": "kind" },
      ExpressionAttributeValues: { ":kind": "EVENT" },
      ScanIndexForward: false,
      Limit: 7,
    });
  });

  it("returns Events without the internal `kind` attribute", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, kind: "EVENT" }] });

    await expect(reader().latest(20)).resolves.toEqual([event]);
  });

  it("drops items that do not match the Event contract", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, url: "javascript:alert(1)" }, event] });

    await expect(reader().latest(20)).resolves.toEqual([event]);
  });

  it("returns an empty list when the query has no Items", async () => {
    ddb.on(QueryCommand).resolves({});

    await expect(reader().latest(20)).resolves.toEqual([]);
  });
});
