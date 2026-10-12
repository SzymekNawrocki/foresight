import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { app as api } from "./app.js";

// Cała appka pod jednym adresem: `/api/*` → API, reszta → zbudowany frontend (apps/web/dist).
// Jedna Lambda zamiast S3 na statyki — reguła 0 zł.
export function createWebApp(staticRoot: string) {
  return new Hono()
    .route("/", api)
    .all("/api/*", (c) => c.notFound())
    .use("*", serveStatic({ root: staticRoot }))
    .get("*", serveStatic({ root: staticRoot, path: "index.html" }));
}
