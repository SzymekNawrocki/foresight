// Wejście Lambdy `web` (Terraform: handler = "index.handler"). Lokalnie ten sam `app` serwuje dev.ts.
import { fileURLToPath } from "node:url";
import { handle } from "hono/aws-lambda";
import { createWebApp } from "./web.js";

// Frontend leży w ZIP-ie obok bundla: index.mjs + public/.
const staticRoot = fileURLToPath(new URL("./public", import.meta.url));

export const handler = handle(createWebApp(staticRoot));
