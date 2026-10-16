import { type DynamoDBDocumentClient, ScanCommand, type ScanCommandInput, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Thesis } from "@foresight/shared";
import type { Resolution } from "./resolve.js";
import type { OpenThesis, ThesisResolutionStore } from "./run.js";

// Data model: docs/data-model.md → `theses`. The resolver is the only reader across owners:
// a filtered Scan of a tiny table once a day, then one conditional update per due Thesis.
export class DynamoResolutionStore implements ThesisResolutionStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async open() {
    const found: OpenThesis[] = [];
    let startKey: ScanCommandInput["ExclusiveStartKey"];
    do {
      const page = await this.client.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: "#status = :open",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":open": "open" },
          ExclusiveStartKey: startKey,
        }),
      );
      for (const { owner, ...item } of page.Items ?? []) {
        const thesis = Thesis.safeParse(item);
        if (typeof owner === "string" && thesis.success) found.push({ owner, thesis: thesis.data });
      }
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    return found;
  }

  async update(owner: string, id: string, resolution: Resolution) {
    const fields = Object.entries(resolution).filter(([, value]) => value !== undefined);
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { owner, id },
        UpdateExpression: `SET ${fields.map(([k]) => `#${k} = :${k}`).join(", ")}`,
        ConditionExpression: "#status = :open",
        ExpressionAttributeNames: { ...Object.fromEntries(fields.map(([k]) => [`#${k}`, k])), "#status": "status" },
        ExpressionAttributeValues: { ...Object.fromEntries(fields.map(([k, v]) => [`:${k}`, v])), ":open": "open" },
      }),
    );
  }
}
