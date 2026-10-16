# Threads and Situation reports instead of Theses

ADR 0007 made Foresight an intelligence hub with investment training on Theses that the market settles automatically. Once the map, the Knowledge base, login and Theses were built (PRs #40–#46), the owner rejected the scoring part: he does not want the app to judge whether he was right, and Theses do not fit how he wants to use it. Foresight becomes a public tool for **following geopolitical situations** and how they move markets and international relations. As of 2026-10-16.

Key decisions from the grilling session:

- **Threads are the core.** A Thread is an ongoing situation (e.g. "Strait of Hormuz", "Taiwan and semiconductors") with a timeline of Events. Single headlines are flat and go stale; analysis is about how a situation evolves.
- **Hybrid creation.** In the same LLM call that analyzes an Event, the model either attaches it to an active Thread or, for Weight ≥ 2, proposes a new one. Proposals wait in a "New situations" inbox; the owner accepts, merges or rejects them. Login (slice 06) is kept for exactly this.
- **Situation report per Thread**, refreshed at most once a day and only for Threads with new Events: current state, actors and their interests, scenarios (escalation / status quo / de-escalation) with warning signals, exposed asset classes, effect on international relations, "what changed", and the most likely scenario. Every version is kept as a situation log.
- **Lifecycle:** active (an Event in the last 14 days) → dormant → archived by the owner. At most 30 active Threads go into the prompt, which keeps the token cost per call bounded.
- **The Event becomes a dispatch:** Regions, Topics, up to 4 **Actors** from a fixed list (~40 states and organisations), Weight, one sentence "why it matters", Thread assignment. The per-Event Scenario is dropped — scenarios live in the Situation report, where the model sees the whole situation, not one headline.
- **Maximum efficiency at 0 PLN:** Events are analyzed in batches of 5 (instructions and the Thread list are sent once per batch), near-duplicate headlines are detected without AI and reuse the original's Analysis, specialist Sources go first in the queue, and token usage is logged.
- **Visibility:** public read-only, owner actions behind login, public API responses cached by CloudFront, footer "AI analysis of headlines, not investment advice".
- **Markets stay qualitative for now.** Prices next to Threads (Tiingo) are a later, separate slice.

## Considered Options

- **Keep Theses but drop automatic settlement** — still a feature the owner does not want to use.
- **AI creates Threads on its own** — no work, but duplicates and dozens of Threads a day.
- **Threads curated by hand only** — Foresight would not notice a new situation, which is what intelligence is for.
- **Full relationship graph between Actors** — the most visual, but needs extra LLM calls per relationship; Actors as tags plus "most often together" is a free first step on the same data.

## Consequences

- PR #46 (settlement) is closed unmerged; PR #44 keeps only the login. The Theses table, API and UI are removed.
- `CONTEXT.md`: Thesis, Instrument, Direction, Horizon, Justification, Resolution and Score leave the glossary; Thread, Situation report, Warning signal, Actor and New situation enter it.
- Slices after cleanup: 09 lean batched Analysis with Actors → 10 Threads and the inbox → 11 Situation report and the new Briefing → 12 Actor pages. Later: prices next to Threads, relationship graph.
- Batching widens the prompt-injection blast radius to the other titles in a batch; accepted (public, low-stakes data, each title fenced) and recorded in the threat model.
