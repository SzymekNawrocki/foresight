import { type DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Thesis } from "@foresight/shared";
import type { ThesisStore } from "./theses.js";

// Data model: docs/data-model.md → `theses`. Partition = owner (Cognito sub), sort = id
// (creation time + random suffix), so one Query returns an owner's Theses newest first.
export class DynamoThesisStore implements ThesisStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async put(owner: string, thesis: Thesis) {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...thesis, owner },
        ConditionExpression: "attribute_not_exists(id)",
      }),
    );
  }

  async list(owner: string) {
    const { Items = [] } = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "#owner = :owner",
        ExpressionAttributeNames: { "#owner": "owner" },
        ExpressionAttributeValues: { ":owner": owner },
        ScanIndexForward: false,
      }),
    );
    return Items.flatMap((item) => {
      // `owner` is the storage key, not part of the Thesis contract (which rejects unknown fields).
      const parsed = Thesis.safeParse(Object.fromEntries(Object.entries(item).filter(([key]) => key !== "owner")));
      return parsed.success ? [parsed.data] : [];
    });
  }
}
