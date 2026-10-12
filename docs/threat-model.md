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
| **T**ampering | Prompt injection via titles (slice 03) | Out of scope here; SPEC → AI security applies when Events go to the LLM | SPEC.md |
| **R**epudiation | No trace of what was ingested | Per-Source report (items / new / duplicate / invalid / error) logged on every run | `runIngest` |
| **I**nformation disclosure | — | Only public news is stored; no user data in this slice | — |
| **D**enial of service | Huge or never-ending feed, slow server | 10 s timeout, 2 MB body cap, read stops at the cap | `fetchFeed` |
| **D**enial of service | XML entity expansion ("billion laughs"), external entities | Documents with `<!DOCTYPE` / `<!ENTITY` rejected before parsing | `parseFeed` |
| **D**enial of service | One broken Source blocks the run | Each Source isolated; failure recorded in the report | `runIngest` |
| **D**enial of service / cost | Write storm exhausts DynamoDB capacity | Provisioned capacity can only throttle, never bill (0 PLN); conditional put makes retries idempotent | `docs/data-model.md` |
| **E**levation of privilege | Ingest Lambda role used to touch other resources | 02b: role limited to `PutItem` on the one table and its own log group | 02b |
