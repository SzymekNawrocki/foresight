# Foresight

A topic radar for one niche: **technology × geopolitics × markets**. Cyber, drones, military
space, chips, AI and the defence industry sit at the centre, with the game between states in the
background and the effect on listed Companies alongside.

Every hour a worker reads RSS from official sources, newsrooms and analysts. An LLM writes a
short dispatch for each Event: is it in the Niche, which Topics, Regions and Actors, its Weight,
why it matters and which Companies it may move. Events build up Threads, and each Thread gets a
rolling Situation report with three Scenarios and warning Signals.

Live: https://d1fsk10xga8rek.cloudfront.net (read-only for visitors; decisions need the owner's sign-in).

It is also a training project: a small app with the weight on the process. It runs serverless on
AWS's free plan (zero cost, no time limit), with Terraform in HCP Terraform, no long-lived keys,
security gates in CI and an AI-native SDLC.

## Screens

| Screen | What it is for |
|---|---|
| **Radar** | What matters in the Niche today: Topic bar, top 8 Events by Weight, Threads that moved, Moves in 24 h |
| **Threads** | Situations followed over time; each has a Situation report, Scenarios, Actors, markets and a timeline |
| **Stream** | Every Niche Event from 72 h with a world map; Region, Topics and Weight filter it |
| **Inbox** | Owner only: New situations proposed by the AI, to follow, join to a Thread or reject |

## Architecture

```
Browser → CloudFront → Lambda "web" (static front end + Hono API) → DynamoDB
EventBridge Scheduler → Lambda "ingest" → RSS + Groq (gpt-oss-120b) → DynamoDB
```

- **Code:** TypeScript end to end in pnpm workspaces: `apps/web` (Vite + React), `apps/api` (Hono), `apps/ingest` (worker), `packages/shared` (Zod contracts).
- **Infrastructure:** Terraform in `infra/` and HCP Terraform. CI and Terraform use OIDC; no static keys.
- **CI:** tests, typecheck, lint, gitleaks, Semgrep, Trivy, Checkov and a zero-cost rule (an allow-list of `aws_*` resource types).
- **Deploy:** signed builds with an SBOM. The deploy waits for the owner's approval in the `production` environment.

## Documentation

- Scope, architecture and the slice plan: [SPEC.md](SPEC.md)
- Domain glossary: [CONTEXT.md](CONTEXT.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Instructions for coding agents: [AGENTS.md](AGENTS.md)

## Status

- **Done:** ingest with Source tiers, v3 dispatches with the Niche gate, Threads with rolling Situation reports, owner decisions, and the graphite-and-brass UI (#71).
- **Next** (SPEC v0.7, audit of 2026-10-28):
  1. #79 Threads come alive.
  2. Slice 13: Niche Sources.
  3. Hardening: CSP, a lazy-loaded map, Dependabot alerts.
  4. Slice 14: Post cards.

## Run locally

Needs Node.js 24+ and pnpm (`corepack enable pnpm`).

```
pnpm install
pnpm dev        # API on :8787, web on http://localhost:5173 (proxies /api)
pnpm test       # vitest in every package
pnpm typecheck
pnpm lint
```

`pnpm --filter @foresight/ingest eval` runs the golden cases through Groq. It needs
`GROQ_API_KEY` in the environment and spends the same daily token budget as production, so
run it once or twice a day at most.
