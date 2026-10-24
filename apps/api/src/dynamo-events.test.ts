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
  niche: true,
  regions: ["europe"],
  topics: ["cyber"],
  actors: ["germany", "russia"],
  companies: [{ company: "CRWD", direction: "up", mechanism: "Popyt na ochronę po ataku." }],
  weight: 2,
  whyItMatters: "Jedno zdanie o ataku.",
  thread: { kind: "none" },
};
const idOf = (n: number) => n.toString(16).padStart(32, "0");
const inNiche = (n: number) => ({ ...event, id: idOf(n), kind: "EVENT", analysis });
const offNiche = (n: number) => ({ ...event, id: idOf(n), kind: "EVENT", analysis: { niche: false } });

describe("DynamoEventReader", () => {
  beforeEach(() => ddb.reset());

  it("queries the `latest` index newest first, reading a few times N to make up for Events off the Niche", async () => {
    ddb.on(QueryCommand).resolves({ Items: [] });

    await reader().latest(7);

    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toEqual({
      TableName: "events",
      IndexName: "latest",
      KeyConditionExpression: "#kind = :kind",
      ExpressionAttributeNames: { "#kind": "kind" },
      ExpressionAttributeValues: { ":kind": "EVENT" },
      ScanIndexForward: false,
      Limit: 21,
    });
  });

  it("returns Events in the Niche with their Analysis, without the internal `kind` attribute", async () => {
    ddb.on(QueryCommand).resolves({ Items: [inNiche(1)] });

    await expect(reader().latest(20)).resolves.toEqual([{ ...event, id: idOf(1), analysis }]);
  });

  it("drops items that do not match the Event contract", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...inNiche(1), url: "javascript:alert(1)" }, inNiche(2)] });

    await expect(reader().latest(20)).resolves.toEqual([{ ...event, id: idOf(2), analysis }]);
  });

  it.each([
    ["off the Niche (ADR 0010)", { niche: false }],
    ["still pending", undefined],
    ["analysed before the Niche (v2)", { regions: ["europe"], topics: ["energy"], actors: [], weight: 2, whyItMatters: "Zdanie.", thread: { kind: "none" } }],
    ["with an Analysis that breaks the contract", { ...analysis, weight: 7 }],
  ])("leaves out an Event %s — the page shows only the Niche", async (_, saved) => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...event, analysis: saved }, inNiche(2)] });

    await expect(reader().latest(20)).resolves.toEqual([{ ...event, id: idOf(2), analysis }]);
  });

  it("reads further pages until it has N Events in the Niche", async () => {
    ddb
      .on(QueryCommand)
      .resolvesOnce({ Items: [inNiche(1), offNiche(2), offNiche(3)], LastEvaluatedKey: { id: "x" } })
      .resolvesOnce({ Items: [offNiche(4), inNiche(5), inNiche(6)], LastEvaluatedKey: { id: "y" } });

    const events = await reader().latest(2);

    expect(events.map((e) => e.id)).toEqual([idOf(1), idOf(5)]);
    expect(ddb.commandCalls(QueryCommand)[1]?.args[0].input.ExclusiveStartKey).toEqual({ id: "x" });
  });

  it("stops after reading 300 items, so a quiet Niche cannot drain the index's read capacity", async () => {
    ddb.on(QueryCommand).callsFake(() => ({ Items: Array.from({ length: 60 }, (_, i) => offNiche(i)), LastEvaluatedKey: { id: "more" } }));

    await expect(reader().latest(20)).resolves.toEqual([]);
    const limits = ddb.commandCalls(QueryCommand).map((c) => c.args[0].input.Limit);
    expect(limits.reduce<number>((sum, n) => sum + (n ?? 0), 0)).toBeLessThanOrEqual(300);
  });

  it("pages through the `latest` index back to a given time, keeping only the Niche", async () => {
    ddb
      .on(QueryCommand)
      .resolvesOnce({ Items: [inNiche(1), offNiche(2)], LastEvaluatedKey: { id: "x" } })
      .resolvesOnce({ Items: [inNiche(3)] });

    const events = await reader().since("2026-10-09T12:00:00.000Z", 500);

    expect(events.map((e) => e.id)).toEqual([idOf(1), idOf(3)]);
    const calls = ddb.commandCalls(QueryCommand).map((c) => c.args[0].input);
    expect(calls[0]).toMatchObject({
      IndexName: "latest",
      KeyConditionExpression: "#kind = :kind AND publishedAt >= :since",
      ExpressionAttributeValues: { ":kind": "EVENT", ":since": "2026-10-09T12:00:00.000Z" },
      ScanIndexForward: false,
      Limit: 500,
    });
    expect(calls[1]).toMatchObject({ ExclusiveStartKey: { id: "x" }, Limit: 498 });
  });

  it("returns an empty list when the query has no Items", async () => {
    ddb.on(QueryCommand).resolves({});

    await expect(reader().latest(20)).resolves.toEqual([]);
  });
});
