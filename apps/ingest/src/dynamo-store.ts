import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { Event } from "@foresight/shared";
import type { EventStore } from "./store.js";

// Data model: docs/data-model.md. `kind` is the partition key of the index for "latest Events".
export class DynamoEventStore implements EventStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async putIfAbsent(event: Event) {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...event, kind: "EVENT" },
          ConditionExpression: "attribute_not_exists(id)",
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
}
