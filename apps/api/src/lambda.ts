// Wejście Lambdy `web` (Terraform: handler = "index.handler"). Lokalnie to samo API serwuje dev.ts.
import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handle } from "hono/aws-lambda";
import { createApi } from "./app.js";
import { DynamoEventReader } from "./dynamo-events.js";
import { createWebApp } from "./web.js";

const tableName = process.env.EVENTS_TABLE_NAME;
if (!tableName) throw new Error("EVENTS_TABLE_NAME is not set");

// Frontend leży w ZIP-ie obok bundla: index.mjs + public/.
const staticRoot = fileURLToPath(new URL("./public", import.meta.url));

const api = createApi({
  events: new DynamoEventReader(DynamoDBDocumentClient.from(new DynamoDBClient()), tableName),
});

export const handler = handle(createWebApp(staticRoot, api));
