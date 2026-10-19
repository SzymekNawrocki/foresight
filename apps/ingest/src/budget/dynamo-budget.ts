import { type DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { BudgetStore } from "./budget.js";

const TTL_DAYS = 30;

// Data model: docs/data-model.md → "threads table". One item per UTC day and model; DynamoDB TTL
// deletes it after 30 days, so the counters never grow.
export class DynamoBudgetStore implements BudgetStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async used(day: string, model: string) {
    const { Item } = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key(day, model) }));
    return typeof Item?.tokens === "number" ? Item.tokens : 0;
  }

  async add(day: string, model: string, tokens: number) {
    const { Attributes } = await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: key(day, model),
        UpdateExpression: "ADD #tokens :tokens SET #expiresAt = if_not_exists(#expiresAt, :expiresAt)",
        ExpressionAttributeNames: { "#tokens": "tokens", "#expiresAt": "expiresAt" },
        ExpressionAttributeValues: { ":tokens": tokens, ":expiresAt": Date.parse(day) / 1000 + TTL_DAYS * 86_400 },
        ReturnValues: "UPDATED_NEW",
      }),
    );
    return typeof Attributes?.tokens === "number" ? Attributes.tokens : tokens;
  }
}

const key = (day: string, model: string) => ({ pk: `BUDGET#${day}`, sk: `MODEL#${model}` });
