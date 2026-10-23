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
const analysis = {
  regions: ["europe"],
  topics: ["energy"],
  actors: ["germany", "russia"],
  weight: 2,
  whyItMatters: "Jedno zdanie o gazie.",
  thread: { kind: "none" },
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

  it("returns the Analysis with the Event when it has one", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, kind: "EVENT", analysis }] });

    await expect(reader().latest(20)).resolves.toEqual([{ ...event, analysis }]);
  });

  it("returns an Analysis saved in the legacy shape too", async () => {
    const legacy = {
      regions: analysis.regions,
      topics: analysis.topics,
      weight: analysis.weight,
      whyItMatters: "Zdanie pierwsze. Zdanie drugie.",
      scenario: {
        escalation: { path: "Eskalacja.", assetClass: "gaz", direction: "up" },
        deescalation: { path: "Deeskalacja.", assetClass: "gaz", direction: "down" },
      },
    };
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, analysis: legacy }] });

    await expect(reader().latest(20)).resolves.toEqual([{ ...event, analysis: legacy }]);
  });

  it("leaves out an Event off the Niche altogether (ADR 0010)", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, analysis: { niche: false } }, { ...event, id: "f".repeat(32), analysis }] });

    await expect(reader().latest(20)).resolves.toEqual([{ ...event, id: "f".repeat(32), analysis }]);
  });

  it("keeps the Event but drops an Analysis that breaks the contract", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, analysis: { ...analysis, weight: 7 } }] });

    await expect(reader().latest(20)).resolves.toEqual([event]);
  });

  it("pages through the `latest` index back to a given time, up to a maximum", async () => {
    ddb
      .on(QueryCommand)
      .resolvesOnce({ Items: [event], LastEvaluatedKey: { id: "x" } })
      .resolvesOnce({ Items: [{ ...event, id: "f".repeat(32) }] });

    const events = await reader().since("2026-10-09T12:00:00.000Z", 500);

    expect(events.map((e) => e.id)).toEqual([event.id, "f".repeat(32)]);
    const calls = ddb.commandCalls(QueryCommand).map((c) => c.args[0].input);
    expect(calls[0]).toMatchObject({
      IndexName: "latest",
      KeyConditionExpression: "#kind = :kind AND publishedAt >= :since",
      ExpressionAttributeValues: { ":kind": "EVENT", ":since": "2026-10-09T12:00:00.000Z" },
      ScanIndexForward: false,
    });
    expect(calls[1]?.ExclusiveStartKey).toEqual({ id: "x" });
  });

  it("returns an empty list when the query has no Items", async () => {
    ddb.on(QueryCommand).resolves({});

    await expect(reader().latest(20)).resolves.toEqual([]);
  });
});
