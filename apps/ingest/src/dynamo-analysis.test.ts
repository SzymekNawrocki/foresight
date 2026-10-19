import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { validAnalysis } from "./analysis/fixtures.js";
import { DynamoAnalysisQueue } from "./dynamo-analysis.js";

const ddb = mockClient(DynamoDBDocumentClient);
const queue = () => new DynamoAnalysisQueue(ddb as unknown as DynamoDBDocumentClient, "events");
const event = {
  id: "0123456789abcdef0123456789abcdef",
  source: "bbc-world",
  title: "Title",
  url: "https://www.bbc.co.uk/news/articles/x1",
  publishedAt: "2026-10-12T16:44:07.000Z",
  fetchedAt: "2026-10-12T18:00:00.000Z",
};

describe("DynamoAnalysisQueue", () => {
  beforeEach(() => ddb.reset());

  it("reads the newest pending Events from the sparse `pending` index", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, kind: "EVENT", pending: "EVENT" }] });

    await expect(queue().pending(10)).resolves.toEqual([event]);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      IndexName: "pending",
      KeyConditionExpression: "#pending = :pending",
      ExpressionAttributeNames: { "#pending": "pending" },
      ExpressionAttributeValues: { ":pending": "EVENT" },
      ScanIndexForward: false,
      Limit: 10,
    });
  });

  it("skips pending items that do not match the Event contract", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, url: "javascript:alert(1)" }] });

    await expect(queue().pending(10)).resolves.toEqual([]);
  });

  it("saves the Analysis and takes the Event off the queue in one update", async () => {
    ddb.on(UpdateCommand).resolves({});

    await queue().saveAnalysis(event.id, validAnalysis);

    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      Key: { id: event.id },
      UpdateExpression: "SET #analysis = :analysis REMOVE #pending",
      ConditionExpression: "attribute_exists(id)",
      ExpressionAttributeNames: { "#analysis": "analysis", "#pending": "pending" },
      ExpressionAttributeValues: { ":analysis": validAnalysis },
    });
  });

  it("counts the backlog on the sparse index without reading the items", async () => {
    ddb.on(QueryCommand).resolvesOnce({ Count: 40, LastEvaluatedKey: { id: "x" } }).resolvesOnce({ Count: 2 });

    await expect(queue().backlog()).resolves.toBe(42);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      IndexName: "pending",
      KeyConditionExpression: "#pending = :pending",
      ExpressionAttributeNames: { "#pending": "pending" },
      ExpressionAttributeValues: { ":pending": "EVENT" },
      Select: "COUNT",
    });
    expect(ddb.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual({ id: "x" });
  });
});
