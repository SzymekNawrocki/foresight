import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { DynamoBudgetStore } from "./dynamo-budget.js";

const ddb = mockClient(DynamoDBDocumentClient);
const store = () => new DynamoBudgetStore(ddb as unknown as DynamoDBDocumentClient, "threads");
const key = { pk: "BUDGET#2026-10-19", sk: "MODEL#openai/gpt-oss-20b" };

describe("DynamoBudgetStore", () => {
  beforeEach(() => ddb.reset());

  it("reads the day's counter", async () => {
    ddb.on(GetCommand).resolves({ Item: { ...key, tokens: 4_200 } });

    await expect(store().used("2026-10-19", "openai/gpt-oss-20b")).resolves.toBe(4_200);
    expect(ddb.commandCalls(GetCommand)[0]?.args[0].input).toEqual({ TableName: "threads", Key: key });
  });

  it("reads a missing counter as zero", async () => {
    ddb.on(GetCommand).resolves({});

    await expect(store().used("2026-10-19", "openai/gpt-oss-20b")).resolves.toBe(0);
  });

  it("adds atomically, sets a 30-day TTL and returns the new total", async () => {
    ddb.on(UpdateCommand).resolves({ Attributes: { tokens: 5_000 } });

    await expect(store().add("2026-10-19", "openai/gpt-oss-20b", 800)).resolves.toBe(5_000);
    expect(ddb.commandCalls(UpdateCommand)[0]?.args[0].input).toEqual({
      TableName: "threads",
      Key: key,
      UpdateExpression: "ADD #tokens :tokens SET #expiresAt = if_not_exists(#expiresAt, :expiresAt)",
      ExpressionAttributeNames: { "#tokens": "tokens", "#expiresAt": "expiresAt" },
      ExpressionAttributeValues: { ":tokens": 800, ":expiresAt": Date.UTC(2026, 10, 18) / 1000 },
      ReturnValues: "UPDATED_NEW",
    });
  });
});
