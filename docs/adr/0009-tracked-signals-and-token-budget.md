# Tracked warning signals, Source tiers and a token budget

ADR 0008 moved scenarios from single headlines into the Situation report of a Thread, but left open how the owner sees *where the world is heading*, which Sources may move a scenario, and how the free Groq limits are shared once Situation reports exist. The MVP is live (map, 11 Sources, login); per-Event escalation / de-escalation branches turned out to say little, because the model sees one headline and writes generic pairs like "escalation → oil up". As of 2026-10-19.

Key decisions from the grilling session:

- **Direction = movement between scenarios over time.** Each scenario in a Situation report has Warning signals. When a dispatch confirms a signal, the signal lights up and the most likely scenario may shift. The owner reads direction as that shift, not as a one-off label.
- **Source tiers.** Every Source has a tier: **A** primary (official statements of governments, organisations, regulators), **B** reliable newsrooms (editorial standards, corrections), **C** analysis (think tanks, trade media). Facts come from A and B, interpretation from C. The exact list is a research task in slice 10.
- **Signals are judged in the Situation report, not per dispatch.** Refreshing a report, the model gets the previous version with its signals plus the new Events of that Thread, and returns which signals lit up. A lit signal must cite the id of an Event from a tier A or B Source; code rejects signals without evidence and evidence from tier C, so the model cannot invent a confirmation.
- **Likelihood on the ICD 203 words-of-estimative-probability scale**, in Polish, seven steps from "prawie wykluczone" to "niemal pewne". The model gives only the current rating; code computes the change arrow (↑ ↓ =) and its reason against the previous version.
- **Two models, two budgets.** `openai/gpt-oss-20b` analyzes dispatches (batches of 5, ≤ 150K tokens/day); `openai/gpt-oss-120b` writes Situation reports (≤ 25/day, ≤ 150K tokens/day). The Groq docs list the same free limits for both (30 RPM, 1K RPD, 8K TPM, 200K TPD); that the limits are per model is to be confirmed in the Groq console before slice 10. A **token budget** records usage from every response and stops before the limit instead of waiting for a 429.
- **Rolling Situation reports.** 8K tokens per minute allow roughly one report per minute and a Lambda runs at most 15 minutes, so every hour, after the ingest, the worker refreshes 2–3 Threads that have new Events and a report older than 24 h, highest Weight first. Each report shows its age.
- **One new table `threads`, single-table design** (`pk`/`sk`, no indexes, provisioned 5/5): Thread meta, timeline entries, report versions, the list of Threads and daily budget counters with TTL. DynamoDB stays at 20 of the 25 free RCU/WCU.
- **Refactor before features.** The Analysis module is shallow and spread over five files (`prompt.ts`, `groq.ts`, `batch.ts`, the schema in `shared`, `handler.ts`), and its interface `analyze(event)` assumes one Event per call. The worker is reshaped into deep modules: Ingest `run()`, Dispatches `analyzePending(budget)`, Situation reports `refreshDue(budget)`, Token budget `reserve` / `record`, and one LLM seam `complete(model, messages, schema)` with a Groq adapter and a fake for tests.
- **Briefing in three layers:** Moves in the last 24 h (scenario shifts and lit signals) → map of Threads per Region → active Threads; raw Events stay on the Stream page.
- **Alarms and freshness.** Three CloudWatch alarms with e-mail through SNS (worker errors, Analysis stalled, no new Events for 6 h) and a freshness line in the footer.
- **Evals.** `pnpm eval` runs ~20 golden headlines against the real model locally before a PR that changes a prompt; the score goes into the PR. Not in CI: every run spends the Groq budget and the key would have to live in GitHub.
- **Markets stay qualitative** in the report; prices next to a Thread come in slice 11, prices as signals later.

## Considered Options

- **Probabilities in percent** — look precise, but an uncalibrated LLM turns noise into false precision.
- **Signals checked per dispatch** — ~250 open signals in every batch prompt and a judgement from one headline.
- **All reports once a day at 06:00** — needs several Lambda runs in a row, and one failure leaves reports stale for a day.
- **Threads inside the `events` table** — the timeline needs a new index (+5 RCU/WCU) and mixes two shapes of data.
- **Everything in one large slice** — rollout steps that must run in order (apply, deploy, new model) collide, and the eval has no baseline.

## Consequences

- Slices 09–12 of ADR 0008 are replaced by three slices: **09 Foundation** (refactor, token log, budget, alarms, freshness — no visible change), **10 Core** (Source tiers, lean batched dispatches with Actors and the eval, Threads and the inbox, rolling Situation reports with signals), **11 View** (new Briefing, prices next to a Thread). Actor pages and prices as signals move to later.
- `CONTEXT.md` gains Source tier, Likelihood and Move; Situation report and Warning signal are sharpened.
- The ingest Lambda becomes a general worker; its role gains access to the `threads` table and a second model is used with the same SSM key.

## Amendment 2026-10-20: dispatches on `gpt-oss-120b`

The eval in slice 10 (#53) measured batches of 5 on the golden cases (55 checks, the injection case left out — it is quarantined before the model). The old prompt (one `gpt-oss-20b` call per Event) scored ~48 at 1,312 tokens per Event.

| Batched dispatches | Run 1 | Run 2 | Batches lost to HTTP 400 | Tokens per Event |
|---|---|---|---|---|
| `gpt-oss-20b`, reasoning low | 44 | 41 | 1 | ~360 |
| `gpt-oss-20b`, reasoning medium | 41 | — (429) | 1 | ~470 |
| `gpt-oss-120b`, reasoning low | 53 | 46 | 0 | ~440 |

With the 20b model, batching drops below the baseline: a batch can collapse (five Events marked as noise after two sports headlines) or come back as broken JSON. Groq strict mode turned out to check the schema only after generating, so an Actor outside the enum ("lithuania") failed a whole batch with a 400.

- **Dispatches move to `gpt-oss-120b`** (reasoning low). At ~240 Events/day that is ~105K tokens/day, so Situation reports share the same model's 200K/day with roughly 80K left (~15–20 reports instead of 25). The split per purpose is added with the reports (step 6 of #53).
- **Labels go to the model as plain strings.** Regions, Topics and Actors are listed in the prompt, not as enums in the schema; code keeps the known values and adds `global` when no Region is left.
- **One invalid dispatch no longer fails its batch.** Only its own Event stays pending; the run report says why Events failed.
