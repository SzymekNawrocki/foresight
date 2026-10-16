import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Thesis } from "@foresight/shared";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoResolutionStore } from "./dynamo.js";

const ddb = mockClient(DynamoDBDocumentClient);
const store = () => new DynamoResolutionStore(ddb as unknown as DynamoDBDocumentClient, "theses");
const thesis: Thesis = {
  id: "2026-10-16T12:00:00.000Z#0a1b2c3d",
  eventId: "0123456789abcdef0123456789abcdef",
  eventTitle: "Title",
  instrument: "BNO",
  direction: "up",
  horizonDays: 7,
  rationale: "Uzasadnienie dłuższe niż dziesięć znaków.",
  regions: ["middle-east"],
  topics: ["energy"],
  createdAt: "2026-10-16T12:00:00.000Z",
  resolveAt: "2026-10-23T12:00:00.000Z",
  status: "open",
};

describe("DynamoResolutionStore", () => {
  beforeEach(() => ddb.reset());

  it("pages through the open Theses of every owner and skips broken items", async () => {
    ddb
      .on(ScanCommand)
      .resolvesOnce({ Items: [{ ...thesis, owner: "a" }], LastEvaluatedKey: { owner: "a", id: thesis.id } })
      .resolvesOnce({ Items: [{ ...thesis, owner: "b" }, { owner: "c", id: "broken" }] });

    await expect(store().open()).resolves.toEqual([
      { owner: "a", thesis },
      { owner: "b", thesis },
    ]);
    expect(ddb.commandCalls(ScanCommand)[0]?.args[0].input).toMatchObject({
      TableName: "theses",
      FilterExpression: "#status = :open",
    });
  });

  it("writes only the resolution fields, and only while the Thesis is still open", async () => {
    ddb.on(UpdateCommand).resolves({});

    await store().update("a", thesis.id, { entryPrice: 100, exitPrice: 103, actual: "up", hit: true, status: "resolved", resolvedAt: "2026-10-24T06:00:00.000Z" });

    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toEqual({
      TableName: "theses",
      Key: { owner: "a", id: thesis.id },
      UpdateExpression: "SET #entryPrice = :entryPrice, #exitPrice = :exitPrice, #actual = :actual, #hit = :hit, #status = :status, #resolvedAt = :resolvedAt",
      ConditionExpression: "#status = :open",
      ExpressionAttributeNames: {
        "#entryPrice": "entryPrice",
        "#exitPrice": "exitPrice",
        "#actual": "actual",
        "#hit": "hit",
        "#status": "status",
        "#resolvedAt": "resolvedAt",
      },
      ExpressionAttributeValues: {
        ":entryPrice": 100,
        ":exitPrice": 103,
        ":actual": "up",
        ":hit": true,
        ":status": "resolved",
        ":resolvedAt": "2026-10-24T06:00:00.000Z",
        ":open": "open",
      },
    });
  });
});
