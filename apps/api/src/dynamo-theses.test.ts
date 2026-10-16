import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Thesis } from "@foresight/shared";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoThesisStore } from "./dynamo-theses.js";

const ddb = mockClient(DynamoDBDocumentClient);
const store = () => new DynamoThesisStore(ddb as unknown as DynamoDBDocumentClient, "theses");
const thesis: Thesis = {
  id: "2026-10-16T12:00:00.000Z#0a1b2c3d",
  eventId: "0123456789abcdef0123456789abcdef",
  eventTitle: "Title",
  instrument: "BNO",
  direction: "up",
  horizonDays: 30,
  rationale: "Uzasadnienie dłuższe niż dziesięć znaków.",
  regions: ["middle-east"],
  topics: ["energy"],
  createdAt: "2026-10-16T12:00:00.000Z",
  resolveAt: "2026-11-15T12:00:00.000Z",
  status: "open",
};

describe("DynamoThesisStore", () => {
  beforeEach(() => ddb.reset());

  it("writes the Thesis under its owner, never over an existing one", async () => {
    ddb.on(PutCommand).resolves({});

    await store().put("owner-1", thesis);

    expect(ddb.commandCalls(PutCommand)[0]?.args[0].input).toEqual({
      TableName: "theses",
      Item: { ...thesis, owner: "owner-1" },
      ConditionExpression: "attribute_not_exists(id)",
    });
  });

  it("reads only the owner's partition, newest first, without the owner attribute", async () => {
    ddb.on(QueryCommand).resolves({ Items: [{ ...thesis, owner: "owner-1" }, { id: "broken" }] });

    await expect(store().list("owner-1")).resolves.toEqual([thesis]);
    expect(ddb.commandCalls(QueryCommand)[0]?.args[0].input).toMatchObject({
      TableName: "theses",
      KeyConditionExpression: "#owner = :owner",
      ExpressionAttributeValues: { ":owner": "owner-1" },
      ScanIndexForward: false,
    });
  });
});
