import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { legacyAnalysis, validAnalysis } from "./analysis/fixtures.js";
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

  const tierQuery = (tier: string) => ({
    TableName: "events",
    IndexName: "pending",
    KeyConditionExpression: "#pending = :pending",
    ExpressionAttributeNames: { "#pending": "pending" },
    ExpressionAttributeValues: { ":pending": tier },
  });
  const inTier = (tier: string) => ({ ExpressionAttributeValues: { ":pending": tier } });

  it("takes pending Events tier by tier — A, B, legacy, then C — newest first within each", async () => {
    const a = { ...event, id: "a".repeat(32) };
    const b = { ...event, id: "b".repeat(32) };
    ddb.on(QueryCommand, inTier("A")).resolves({ Items: [{ ...a, pending: "A" }] });
    ddb.on(QueryCommand, inTier("B")).resolves({ Items: [{ ...b, pending: "B" }] });
    ddb.on(QueryCommand, inTier("EVENT")).resolves({ Items: [{ ...event, pending: "EVENT" }] });

    await expect(queue().pending(3)).resolves.toEqual([a, b, event]);
    expect(ddb.commandCalls(QueryCommand).map((call) => call.args[0].input)).toEqual([
      { ...tierQuery("A"), ScanIndexForward: false, Limit: 3 },
      { ...tierQuery("B"), ScanIndexForward: false, Limit: 2 },
      { ...tierQuery("EVENT"), ScanIndexForward: false, Limit: 1 },
    ]);
  });

  it("does not read tier C while the higher tiers fill the batch", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });
    ddb.on(QueryCommand, inTier("A")).resolves({ Items: [{ ...event, pending: "A" }] });

    await expect(queue().pending(1)).resolves.toEqual([event]);
    expect(ddb.commandCalls(QueryCommand)).toHaveLength(1);
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

  it("counts the backlog in every tier on the sparse index without reading the items", async () => {
    ddb.on(QueryCommand).resolves({ Count: 0 });
    ddb.on(QueryCommand, inTier("A")).resolvesOnce({ Count: 40, LastEvaluatedKey: { id: "x" } }).resolvesOnce({ Count: 2 });
    ddb.on(QueryCommand, inTier("C")).resolves({ Count: 5 });

    await expect(queue().backlog()).resolves.toBe(47);
    const inputs = ddb.commandCalls(QueryCommand).map((call) => call.args[0].input);
    expect(inputs[0]).toEqual({ ...tierQuery("A"), Select: "COUNT" });
    expect(inputs[1]?.ExclusiveStartKey).toEqual({ id: "x" });
    expect(inputs.map((input) => input.ExpressionAttributeValues?.[":pending"])).toEqual(["A", "A", "B", "EVENT", "C"]);
  });

  it("reads titles and Analyses published since a time from the `latest` index, page by page", async () => {
    ddb
      .on(QueryCommand)
      .resolvesOnce({ Items: [{ title: "First", analysis: validAnalysis }], LastEvaluatedKey: { id: "x" } })
      .resolvesOnce({ Items: [{ title: "Second", analysis: validAnalysis }] });

    await expect(queue().recent("2026-10-18T12:00:00.000Z")).resolves.toEqual([
      { title: "First", analysis: validAnalysis },
      { title: "Second", analysis: validAnalysis },
    ]);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      IndexName: "latest",
      KeyConditionExpression: "#kind = :kind AND #publishedAt >= :since",
      FilterExpression: "attribute_exists(#analysis)",
      ProjectionExpression: "#title, #analysis",
      ExpressionAttributeNames: { "#kind": "kind", "#publishedAt": "publishedAt", "#analysis": "analysis", "#title": "title" },
      ExpressionAttributeValues: { ":kind": "EVENT", ":since": "2026-10-18T12:00:00.000Z" },
    });
    expect(ddb.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual({ id: "x" });
  });

  it("leaves out legacy and malformed Analyses, which cannot be reused", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [
        { title: "Legacy", analysis: legacyAnalysis },
        { title: "Broken", analysis: { weight: 9 } },
        { title: "Current", analysis: validAnalysis },
      ],
    });

    await expect(queue().recent("2026-10-18T12:00:00.000Z")).resolves.toEqual([{ title: "Current", analysis: validAnalysis }]);
  });
});
