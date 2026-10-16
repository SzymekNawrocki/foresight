import { ConfigResponse, MeResponse } from "@foresight/shared";
import { describe, expect, it } from "vitest";
import { createApi } from "./app.js";
import type { TokenVerifier } from "./auth.js";
import { InMemoryEventReader } from "./events.js";

// Tokens are verified by Cognito in production; here one fixed token maps to the owner.
const verifier: TokenVerifier = { verify: async (token) => (token === "owner-token" ? "owner" : null) };
const api = (auth = true) =>
  createApi({
    events: new InMemoryEventReader(),
    ...(auth && { auth: { verifier, config: { domain: "https://login.example.com", clientId: "client-1" } } }),
  });

describe("GET /api/config", () => {
  it("gives the page the public login settings", async () => {
    const res = await api().request("/api/config");

    expect(ConfigResponse.parse(await res.json())).toEqual({
      auth: { domain: "https://login.example.com", clientId: "client-1" },
    });
  });

  it("says there is no login when none is configured (local dev)", async () => {
    expect(await (await api(false).request("/api/config")).json()).toEqual({ auth: null });
  });
});

describe("GET /api/me", () => {
  it("rejects a missing or forged token", async () => {
    expect((await api().request("/api/me")).status).toBe(401);
    expect((await api().request("/api/me", { headers: { "x-foresight-token": "forged" } })).status).toBe(401);
  });

  it("does not trust the standard Authorization header (CloudFront OAC overwrites it)", async () => {
    expect((await api().request("/api/me", { headers: { authorization: "Bearer owner-token" } })).status).toBe(401);
  });

  it("confirms a valid owner token, never cached", async () => {
    const res = await api().request("/api/me", { headers: { "x-foresight-token": "owner-token" } });

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(MeResponse.parse(await res.json())).toEqual({ signedIn: true });
  });
});
