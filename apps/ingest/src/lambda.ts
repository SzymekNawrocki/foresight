// Entry point of the `ingest` Lambda (Terraform: handler = "index.handler"), run by EventBridge Scheduler.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoEventStore } from "./dynamo-store.js";
import { fetchFeed } from "./feed.js";
import { createHandler } from "./handler.js";
import { SOURCES } from "./sources.js";

const tableName = process.env.TABLE_NAME;
if (!tableName) throw new Error("TABLE_NAME is not set");

export const handler = createHandler({
  sources: SOURCES,
  fetchFeed: (url) => fetchFeed(url),
  store: new DynamoEventStore(DynamoDBDocumentClient.from(new DynamoDBClient()), tableName),
  log: console.log,
});
