// Wejście Lambdy `web` (Terraform: handler = "index.handler"). Lokalnie to samo API serwuje dev.ts.
import { fileURLToPath } from "node:url";
import { handle } from "hono/aws-lambda";
import { createApi } from "./app.js";
import { InMemoryEventReader } from "./events.js";
import { createWebApp } from "./web.js";

// Frontend leży w ZIP-ie obok bundla: index.mjs + public/.
const staticRoot = fileURLToPath(new URL("./public", import.meta.url));

// TODO(#28): DynamoEventReader on GSI `latest` — next step.
const api = createApi({ events: new InMemoryEventReader() });

export const handler = handle(createWebApp(staticRoot, api));
