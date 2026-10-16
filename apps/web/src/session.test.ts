import { afterEach, describe, expect, it, vi } from "vitest";
import { authedFetch, completeSignIn, pkceChallenge, readSession, signIn } from "./session.js";

const config = { domain: "https://login.example.com", clientId: "client-1" };

afterEach(() => sessionStorage.clear());

describe("PKCE", () => {
  it("derives the S256 challenge from the verifier (RFC 7636, appendix B)", async () => {
    await expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).resolves.toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("signIn", () => {
  it("sends the browser to the Cognito login with code flow, PKCE and a random state", async () => {
    const go = vi.fn();
    await signIn(config, "https://app.example.com", go);

    const url = new URL(go.mock.calls[0]?.[0]);
    expect(url.origin + url.pathname).toBe("https://login.example.com/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toMatch(/^[\w-]{32,}$/);
  });
});

describe("completeSignIn", () => {
  it("refuses a callback whose state does not match (login CSRF)", async () => {
    await signIn(config, "https://app.example.com", () => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      completeSignIn(config, "https://app.example.com", "https://app.example.com/auth/callback?code=abc&state=forged"),
    ).rejects.toThrow("state");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swaps the code for tokens with the PKCE verifier and keeps the session in this tab", async () => {
    const go = vi.fn();
    await signIn(config, "https://app.example.com", go);
    const state = new URL(go.mock.calls[0]?.[0]).searchParams.get("state");
    const fetchMock = vi.fn(async () => Response.json({ access_token: "access-1", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    await completeSignIn(config, "https://app.example.com", `https://app.example.com/auth/callback?code=abc&state=${state}`);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://login.example.com/oauth2/token");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("abc");
    expect(body.get("code_verifier")).toMatch(/^[\w-]{43,128}$/);
    expect(readSession()?.accessToken).toBe("access-1");
  });
});

describe("authedFetch", () => {
  it("sends the token in our own header and the body hash CloudFront OAC needs", async () => {
    sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "access-1", expiresAt: Date.now() + 60_000 }));
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await authedFetch("/api/theses", { method: "POST", body: "{}" });

    const headers = new Headers((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers);
    expect(headers.get("x-foresight-token")).toBe("access-1");
    expect(headers.get("authorization")).toBeNull();
    // SHA-256 of "{}"
    expect(headers.get("x-amz-content-sha256")).toBe("44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a");
  });

  it("forgets an expired session", () => {
    sessionStorage.setItem("foresight.session", JSON.stringify({ accessToken: "old", expiresAt: Date.now() - 1 }));

    expect(readSession()).toBeNull();
  });
});
