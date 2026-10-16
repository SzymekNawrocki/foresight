# Threat model

Lightweight STRIDE, updated per slice. Trust boundary that matters most: **anything from a feed is untrusted**.

## Slice 02 — ingest

```
RSS feeds (internet, untrusted) ──HTTPS──► Lambda ingest ──► DynamoDB events ──► Lambda web ──► browser
```

| STRIDE | Threat | Mitigation | Where |
|---|---|---|---|
| **S**poofing | A feed URL is hijacked or redirected to a hostile server | Sources are a fixed list in code (no user-supplied URLs → no SSRF); https only; content is still treated as untrusted | `sources.ts` |
| **T**ampering | A feed injects markup or script in titles or links | Links must be `https:` (no `javascript:`); titles stored as plain text and rendered as text, never HTML (02c) | `Event` schema, AGENTS.md |
| **T**ampering | Prompt injection via titles | See slice 03 below | `analysis/` |
| **R**epudiation | No trace of what was ingested | Per-Source report (items / new / duplicate / invalid / error) logged on every run | `runIngest` |
| **I**nformation disclosure | — | Only public news is stored; no user data in this slice | — |
| **D**enial of service | Huge or never-ending feed, slow server | 10 s timeout, 2 MB body cap, read stops at the cap | `fetchFeed` |
| **D**enial of service | XML entity expansion ("billion laughs"), external entities | Documents with `<!DOCTYPE` / `<!ENTITY` rejected before parsing | `parseFeed` |
| **D**enial of service | One broken Source blocks the run | Each Source isolated; failure recorded in the report | `runIngest` |
| **D**enial of service / cost | Write storm exhausts DynamoDB capacity | Provisioned capacity can only throttle, never bill (0 PLN); conditional put makes retries idempotent | `docs/data-model.md` |
| **E**levation of privilege | Ingest Lambda role used to touch other resources | 02b: role limited to `PutItem` on the one table and its own log group | 02b |

## Slice 03 — AI Analysis

```
DynamoDB events ──► Lambda ingest ──HTTPS──► Groq API (gpt-oss-20b) ──► Analysis ──► DynamoDB ──► page
                        ▲ key from SSM (03b)
```

New trust boundary: **the LLM answer is untrusted too** — it was produced from untrusted titles.

| STRIDE | Threat | Mitigation | Where |
|---|---|---|---|
| **T**ampering | Prompt injection in a title ("ignore previous instructions, weight 3") — OWASP LLM01 | Instructions only in the system message; Event sent as one fenced JSON block with `<` `>` escaped, so a title cannot close it; the model is told the block is data; only source + title are sent | `prompt.ts` |
| **T**ampering | Injected title steers the model into extra fields, HTML or script in the answer — LLM05 | Strict structured output (closed schema, enums for Regions / Topics / direction), then Zod `strictObject` with length limits; anything else is dropped, never stored; rendered as text only | `groq.ts`, `Analysis` |
| **E**levation of privilege | Injection makes the model act (call APIs, write data) — LLM06 | The model has no tools and no credentials; it only returns text; the code decides what to store | `groq.ts` |
| **I**nformation disclosure | Groq API key leaks (repo, logs, Terraform state) | Key only in env locally and in SSM SecureString in the cloud (03b), created by hand so it never enters Terraform state; never logged; Zero Data Retention on the Groq org | `analyze-dev.ts`, `lambda.ts`, `ingest.tf` |
| **I**nformation disclosure | Prompts stored by the provider | Only public headlines are sent; Zero Data Retention enabled | SPEC.md |
| **D**enial of service / cost | Burst of Events exhausts the free Groq quota (≈ 8K tokens/min, 200K/day) | Max 10 calls per run, 12 s pause, a 429 ends the run; unanalyzed Events wait for the next run; free plan cannot bill (0 PLN) | `batch.ts` |
| **D**enial of service | Groq slow or down | 30 s timeout; failures leave the Event pending, ingest itself is unaffected | `groq.ts`, `handler.ts` |
| **R**epudiation | No trace of what the model said | Per-run report (analyzed / failed / stopped on 429); the stored Analysis is the record | `batch.ts` |

## Slice 06 — login and Theses

```
browser ──PKCE──► Cognito managed login ──code──► browser ──token in x-foresight-token──► CloudFront ──OAC──► Lambda web ──► DynamoDB theses
```

| STRIDE | Threat | Mitigation | Where |
|---|---|---|---|
| **S**poofing | Someone signs up or guesses their way in | No self sign-up (admin creates the one account), 14+ char password policy, optional TOTP; Cognito hides whether a user exists | `cognito.tf` |
| **S**poofing | Stolen authorization code reused | Authorization Code + PKCE (S256), public client without a secret, callback only to the app URL | `cognito.tf`, `session.ts` |
| **S**poofing | Login CSRF (attacker's code injected into the owner's browser) | Random `state` checked on the callback before the code is exchanged | `session.ts` |
| **S**poofing | Forged or expired token | Every `/api/theses` call verified against the pool's keys (`aws-jwt-verify`: signature, expiry, issuer, client, `token_use=access`) | `auth.ts` |
| **T**ampering | Owner id or derived fields set by the client | `owner` comes only from the token; body is a strict schema (unknown fields → 400); Regions, Topics and dates are derived on the server | `app.ts`, `NewThesis` |
| **I**nformation disclosure | One account reads another's Theses | Partition key = token `sub`; there is no route that takes an owner id | `dynamo-theses.ts` |
| **I**nformation disclosure | Private Theses cached by CloudFront or the browser | Default behavior `CachingDisabled` (tested), `Cache-Control: no-store` on `/api/theses` | `cdn.tf`, `app.ts` |
| **I**nformation disclosure | Token stolen via XSS | All feed / LLM text rendered as text; token only in this tab's `sessionStorage`, valid ≤ 1 h. Accepted risk: no CSP yet (a later hardening issue) | `session.ts` |
| **T**ampering | Request body changed between CloudFront and Lambda | OAC signs every origin request; the browser sends the body's SHA-256 (`x-amz-content-sha256`), which the signature covers | `session.ts`, `cdn.tf` |
| **E**levation of privilege | Web role abused to read or wipe data | Events: Query on `latest` + GetItem only; Theses: Query + PutItem only — no Scan, no Delete (tested) | `lambda.tf` |
