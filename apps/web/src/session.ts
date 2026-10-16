import { useSyncExternalStore } from "react";

// Logowanie właściciela: Cognito, Authorization Code + PKCE (klient publiczny, bez sekretu).
// Token dostępu żyje tylko w sessionStorage tej karty i najwyżej godzinę.

export interface AuthSettings {
  domain: string;
  clientId: string;
}

interface Session {
  accessToken: string;
  expiresAt: number;
}

const SESSION_KEY = "foresight.session";
const PENDING_KEY = "foresight.pending-login";
const listeners = new Set<() => void>();

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const randomString = (bytes = 32) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256 = async (text: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

export const pkceChallenge = async (verifier: string) => base64url(await sha256(verifier));

const redirectUri = (origin: string) => `${origin}/auth/callback`;

function store(key: string, value: unknown) {
  if (value === null) sessionStorage.removeItem(key);
  else sessionStorage.setItem(key, JSON.stringify(value));
}

function load<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function readSession(): Session | null {
  const session = load<Session>(SESSION_KEY);
  if (!session || typeof session.accessToken !== "string" || session.expiresAt <= Date.now()) return null;
  return session;
}

function setSession(session: Session | null) {
  store(SESSION_KEY, session);
  for (const listener of listeners) listener();
}

export async function signIn(config: AuthSettings, origin: string, go: (url: string) => void = (u) => window.location.assign(u)) {
  const verifier = randomString(48);
  const state = randomString(24);
  store(PENDING_KEY, { verifier, state });
  const url = new URL("/oauth2/authorize", config.domain);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri(origin),
    scope: "openid email",
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: "S256",
    state,
  }).toString();
  go(url.toString());
}

export async function completeSignIn(config: AuthSettings, origin: string, callbackUrl: string) {
  const params = new URL(callbackUrl).searchParams;
  const pending = load<{ verifier: string; state: string }>(PENDING_KEY);
  store(PENDING_KEY, null);
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) throw new Error("Login state mismatch");

  const res = await fetch(new URL("/oauth2/token", config.domain).toString(), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: redirectUri(origin),
      code_verifier: pending.verifier,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof body.access_token !== "string" || typeof body.expires_in !== "number") throw new Error("Bad token response");
  setSession({ accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 });
}

export function signOut(config: AuthSettings | null, origin: string, go: (url: string) => void = (u) => window.location.assign(u)) {
  setSession(null);
  if (!config) return;
  const url = new URL("/logout", config.domain);
  url.search = new URLSearchParams({ client_id: config.clientId, logout_uri: `${origin}/` }).toString();
  go(url.toString());
}

export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => readSession()?.accessToken ?? null,
  );
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// CloudFront OAC overwrites `Authorization` with its own signature, so the token goes in a
// header of ours; for a body, Lambda URLs behind OAC need its SHA-256 in x-amz-content-sha256.
export async function authedFetch(path: string, init: RequestInit = {}) {
  const session = readSession();
  if (!session) throw new Error("Not signed in");
  const headers = new Headers(init.headers);
  headers.set("x-foresight-token", session.accessToken);
  if (typeof init.body === "string") {
    headers.set("content-type", "application/json");
    headers.set("x-amz-content-sha256", hex(await sha256(init.body)));
  }
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) setSession(null);
  return res;
}
