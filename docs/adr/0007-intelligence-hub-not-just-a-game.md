# Foresight is a geostrategy intelligence hub, not just a prediction game

Foresight started as a small prediction game whose real purpose was training the cloud and delivery process (SPEC v0.2). After slice 02 put real Events on the page, the owner decided that the product itself matters: it should be something he uses every day. The app becomes a private geostrategy intelligence hub at the intersection of **geostrategy × tech × investing**: a daily Briefing on a world map, a Knowledge base by Region and Topic, and investment training on Theses that the market settles. It stays the training vehicle for Phase 8. As of 2026-10-13.

Key decisions from the grilling session:

- **Two axes:** 7 geostrategic Regions plus Global, and a fixed list of 8 Topics: Cyber, AI, Battlefield, Space, Semiconductors, Commodities, Energy, Sanctions and trade. A short fixed list keeps LLM classification accurate and per-Topic statistics meaningful.
- **One LLM call per Event** (Polish output): Regions, Topics, Weight 1–3, "why it matters", and a Scenario with two Branches.
- **Theses stay in the MVP** and point at a concrete Instrument from a short list (~20, mostly sector ETFs and commodities). They are **settled automatically** from prices, with a ±2% band counting as "no change". Self-grading a vague asset class would make the statistics worthless for training. This reverses SPEC v0.2, which listed automatic settlement as out of scope. Condition: a free price source whose terms allow this use; otherwise settlement falls back to manual.
- **Visibility:** the Briefing and Knowledge base are public and read-only; Theses and the Score are private to the single owner account.
- **Facebook stays outside the app.** The owner plans a page on the same three axes and writes the posts himself; the app is the workshop that supplies the material.

## Considered Options

- **Keep the v0.2 game** (manual settlement, asset classes only) — cheaper, but it does not give daily value and its statistics cannot be trusted.
- **Briefing only, no Theses** — loses the investment training and the statistics the owner asked for.
- **Full entity graph** (countries, companies, technologies, links) — a separate project: entity resolution, deduplication and many more LLM calls than the free Groq tier allows.
- **Auto-publishing to Facebook** (Graph API) — Meta app review and long-lived page tokens, with nothing to learn about investing; breaks the no-static-keys rule.

## Consequences

- Slices 03–07: AI analysis → map and Knowledge base → better Sources → login and Theses → settlement and Score (SPEC v0.3).
- New domain terms in `CONTEXT.md`: Region, Topic, Weight, Briefing, Knowledge base, Instrument, Justification.
- New facts to verify before the slice that needs them: Groq free-tier limits (03), the free login option for one account (06), and the price data source (07).
- Moved to `later`: post drafts for Facebook, notes in the Knowledge base, weekly AI summaries, public statistics.
