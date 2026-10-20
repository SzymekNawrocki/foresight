import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { type DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { Event } from "@foresight/shared";
import type { SourceTier } from "./sources.js";
import type { EventStore } from "./store.js";

// Data model: docs/data-model.md. `kind` keys the "latest Events" index; `pending` keys the sparse
// index of Events still waiting for their Analysis, partitioned by Source tier (removed once the
// Analysis is saved).
export class DynamoEventStore implements EventStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async putIfAbsent(event: Event, tier: SourceTier) {
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...event, kind: "EVENT", pending: tier },
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
