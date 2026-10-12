import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HealthResponse } from "@foresight/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApi } from "./app.js";
import { InMemoryEventReader } from "./events.js";
import { createWebApp } from "./web.js";

// Udajemy zbudowany frontend (apps/web/dist) w katalogu tymczasowym.
let staticRoot: string;
const api = createApi({ events: new InMemoryEventReader() });

beforeAll(() => {
  staticRoot = mkdtempSync(join(tmpdir(), "foresight-web-"));
  mkdirSync(join(staticRoot, "assets"));
  writeFileSync(join(staticRoot, "index.html"), "<!doctype html><title>Foresight</title>");
  writeFileSync(join(staticRoot, "assets", "app.js"), "console.log('app');");
});

afterAll(() => {
  rmSync(staticRoot, { recursive: true, force: true });
});

describe("createWebApp", () => {
  it("serves the API under /api", async () => {
    const res = await createWebApp(staticRoot, api).request("/api/health");

    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: "ok" });
  });

  it("serves index.html at the root", async () => {
    const res = await createWebApp(staticRoot, api).request("/");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    expect(await res.text()).toContain("<title>Foresight</title>");
  });

  it("serves built assets with their content type", async () => {
    const res = await createWebApp(staticRoot, api).request("/assets/app.js");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/javascript/);
  });

  it("falls back to index.html for client-side routes", async () => {
    const res = await createWebApp(staticRoot, api).request("/theses/42");

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>Foresight</title>");
  });

  it("keeps 404 for unknown API routes instead of the page fallback", async () => {
    const res = await createWebApp(staticRoot, api).request("/api/nope");

    expect(res.status).toBe(404);
  });

  it("does not serve files outside the static root", async () => {
    const res = await createWebApp(staticRoot, api).request("/..%2fpackage.json");

    expect(await res.text()).not.toContain("@foresight/api");
  });
});
