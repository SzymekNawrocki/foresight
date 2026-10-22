# Tech-first niche: a topic radar for the owner's page

ADR 0007–0009 built Foresight as a general geopolitics tracker: every Event gets a dispatch, Threads collect situations and Situation reports follow scenarios. The owner now wants Foresight to feed a Facebook page in one niche, and the live data shows the general scope does not serve it. As of 2026-10-22.

Audit of the live data (500 latest Events, 481 analyzed):

- **0 active Threads.** CloudFront rejected POST (#63), so no New situation could be accepted.
- **43 New situations, every name different** — five separate proposals about Ukraine (Starlink, drones, satellites, espionage, peace), four about Iran, names mixed Polish and English. Without seed Threads the model has nothing to attach to and proposes a new one each time; the inbox would grow by ~20 items a day.
- **Mostly outside the niche.** 122 of 481 dispatches have a tech Topic; `battlefield` also catches raids and land disputes with no technology in them. A full geo × tech × markets match is ~10–15 Events a day. Al Jazeera alone is 39% of the stream.

Key decisions:

- **The niche is tech first.** Foresight shows only Events where a **technology is at the centre**: cyber attacks and hacking, drone warfare, military space, the chip war, AI in defence and the AI race between states, the defence industry and its contracts. Next to the technology there is a **geo** stake (states or blocs playing against each other) and a **market** effect (listed companies whose price moves or may move). Pure geopolitics without technology (Gaza, elections, settlements) is not part of the product.
- **Six niche Topics replace the eight general ones:** Cyber, Drony, Kosmos, Chipy, AI, Zbrojeniówka. Energy, commodities and sanctions are no longer Topics; they appear as the market effect of a tech Event (a drone strike on a refinery → Drony, with fuel prices as the effect). Old Analyses keep their old Topics and stay readable.
- **Every dispatch answers "in the niche?" first.** The model returns `niche: false` with nothing else for an Event outside the niche — this also makes such answers cheaper. Out-of-niche Events are stored but shown nowhere: not on the Briefing, the Stream, the map nor in Threads.
- **Market impact on Companies from a fixed list.** A niche dispatch names up to 3 Companies with a direction (↑ up, ↓ down, ↕ uncertain) and one sentence of mechanism ("why the price may move"). Companies come from a fixed list of ~45 (defence and drones, cyber, space, chips, AI platforms, a few ETFs, Polish listed names) with tickers, checked by code like Actors, so the model cannot invent a ticker. The list is accepted by the owner. Impact is qualitative — no price data yet (#60) and no buy/sell advice.
- **Weight stays**, but now measures how much the Event matters inside the niche.
- **Seed Threads instead of a cold start.** The owner accepts ~8 niche Threads before the new prompt goes live (e.g. drone war in Ukraine, US–China export controls on chips, state-backed attacks on infrastructure, Starlink and alternatives). New situations are grouped in code: a proposal with the same Topic and overlapping Actors as an open proposal from the last 7 days joins it instead of opening another one. Thread names are always in Polish.
- **Post cards for the owner, in the app only.** Every day the Briefing shows **3 Post cards**: a hook, the tech, the geo stake, the Companies with direction and the source links. The owner writes the posts; Foresight does the research. No e-mail, no automatic publishing.
- **Sources follow the niche.** A research step replaces part of the general newsrooms with trade media and official sources for cyber, defence, space and chips; the owner accepts the list. Tiers A/B/C from ADR 0009 stay.

## Considered Options

- **Keep the general tracker and filter only on the Briefing** — tokens and Thread proposals would still be spent on the 75% of Events the owner never reads.
- **A cheap keyword pre-filter before the model** — misses "Long Wall wins MDA interceptor contract" and passes "AI-generated song tops the charts"; the batch call is cheap enough to decide.
- **Free tickers from the model** — invented or wrong tickers, and no stable key for prices later.
- **Generated posts** — the page is the owner's voice; drafts would make it a reposting bot.
- **E-mail digest of the cards** — the owner prefers to open the app when writing.

## Consequences

- Three slices replace further work on the general tracker: **12 Loop and niche** (CloudFront POST fix, dispatch v3 with the niche gate, Topics and Companies, eval relabelled for the niche, seed Threads, grouped proposals), **13 Niche Sources** (research and accepted list), **14 Post cards** (daily 3 cards on the Briefing, Companies in the Situation report instead of asset classes). Prices next to Companies stay in #60.
- `CONTEXT.md`: Topic is redefined; Nisza, Spółka, Wpływ na Spółkę and Karta posta are added; Klasa aktywów gives way to Wpływ na Spółkę.
- Events analyzed before slice 12 have no `niche` flag; they drop out of the views as they age (48 h), no reanalysis.
- `#31` (draft a Facebook post) is replaced by Post cards and closed.
