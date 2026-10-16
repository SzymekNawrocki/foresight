// Wejście Lambdy `web` (Terraform: handler = "index.handler"). Lokalnie to samo API serwuje dev.ts.
import { fileURLToPath } from "node:url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handle } from "hono/aws-lambda";
import { createApi } from "./app.js";
import { cognitoVerifier } from "./auth.js";
import { DynamoEventReader } from "./dynamo-events.js";
import { createWebApp } from "./web.js";

const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};

// Frontend leży w ZIP-ie obok bundla: index.mjs + public/.
const staticRoot = fileURLToPath(new URL("./public", import.meta.url));
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const clientId = env("USER_POOL_CLIENT_ID");

const api = createApi({
  events: new DynamoEventReader(ddb, env("EVENTS_TABLE_NAME")),
  auth: {
    verifier: cognitoVerifier(env("USER_POOL_ID"), clientId),
    config: { domain: env("AUTH_DOMAIN"), clientId },
  },
});

export const handler = handle(createWebApp(staticRoot, api));
