import { HealthResponse } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

describe("GET /api/health", () => {
  it("responds 200 with a body matching the shared HealthResponse contract", async () => {
    const res = await app.request("/api/health");

    expect(res.status).toBe(200);
    expect(HealthResponse.parse(await res.json())).toEqual({ status: "ok" });
  });

  it("responds 404 for unknown API routes", async () => {
    const res = await app.request("/api/nope");

    expect(res.status).toBe(404);
  });
});
