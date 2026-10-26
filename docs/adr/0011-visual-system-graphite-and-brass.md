# Visual system: graphite and brass on shadcn/ui with Base UI

The first interface (#40) used an "intelligence dossier" style: near-black, alarm red, scanlines, a condensed uppercase font and a ticking UTC clock. It looked good but read badly. Red stood for urgent, active, link and focus all at once. 11–13 px uppercase text was tiring to read. Topic and Region pages took up the menu. After the Niche turn (ADR 0010) the owner opens Foresight to answer one question: what matters in the Niche today, and is it worth a post? The UI needs to answer that quietly. Decided in a design interview on 2026-10-24 (#71).

Key decisions:

- **Dark theme only, graphite and warm white.** Base `#111317`, surfaces `#181b21` and `#20242b`, lines `#2e333b`. Text `#e8e4da` with two dimmer steps, `#aaa597` and `#938f83`. No scanlines and no grid. Cards are rounded and softly outlined.
- **One accent: brass `#c9a45c`.** It was chosen from three samples (brass, phosphor green, signal orange). Phosphor felt like a hacker movie and orange was too close to "urgent".
- **One colour, one meaning.** These are the only colours components may use:

  | Token | Hex | Means only |
  |---|---|---|
  | `coral` | `#ef6b5b` | urgent / Breakthrough (Weight 3), and Company ↓ |
  | `copper` | `#e08a4a` | Significant (Weight 2) |
  | `sage` | `#7fbf8e` | Company ↑, and the link to the API is up |
  | `brass` | `#c9a45c` | "changed, look here" and navigation: +N new, lit signal, active tab, links on hover, focus ring |
  | `dim` / `faint` | `#aaa597` / `#938f83` | unchanged, waiting, secondary text |

  A change of Likelihood is not good or bad, so it is shown as an arrow and a word in brass. Colour never carries meaning alone: a word or an icon always goes with it.
- **Contrast is WCAG AA.** Every text token is at least 4.5:1 on all three surfaces. The tightest pair is `faint` on `#20242b` at 4.82:1, and the dark text on a brass button is 7.9:1. The values were checked with the WCAG relative-luminance formula when the tokens were chosen.
- **Components: shadcn/ui on Base UI, with `lucide-react` icons.** Base UI has been shadcn's default primitive layer since July 2026. It gives accessible behaviour for focus, keyboard, ARIA and portals, so we don't write that ourselves. The component code is copied into `apps/web/src/ui/` (shadcn's copy-in model, no CLI, no `components.json`) and styled only with our tokens. We add a component only when a screen uses it. The foundation has Button, Badge, Card, Skeleton and Tooltip. Tabs, ToggleGroup, Dialog and Menu come with the slices that need them.
- **Type.** IBM Plex Sans 400/500/600 for text: 15 px body, 17 px card titles, 28 px page titles, sentence case. JetBrains Mono for numbers, times, tickers and Sources. Uppercase only in section labels, with 0.06 em tracking. Fonts are self-hosted through `@fontsource`, so no request goes to a font CDN. IBM Plex Sans Condensed is dropped.
- **Four places in the menu:** Radar · Threads · Stream · Inbox. The Inbox shows only to the owner and carries a count. Topics and Regions are now Stream filters kept in the URL. The old `/topic/:topic` and `/region/:region` addresses redirect to the Stream with that filter. An unknown value in the URL is dropped, not trusted.
- **Copy is clear first, with mood as seasoning.** Every screen has a one-line subtitle saying what it is for. Errors say what happened and offer a retry. Times are relative ("2 h temu"), and the full Europe/Warsaw time shows on hover and is read by screen readers. The mood stays only in loading skeletons and the 404 page. The UTC clock and the "internal use" badge are gone.
- **Motion respects `prefers-reduced-motion`.** Animations and transitions are cut to near zero when the user asks for it.

## Considered Options

- **Keep the dossier style, only fix contrast.** That doesn't solve red meaning four things or the menu crowded with Topics.
- **Indigo or sea-green accent.** The owner rejected both as generic SaaS colours.
- **Radix-based shadcn/ui.** It works, but Base UI is now shadcn's default and is actively developed. Starting a new component set on the older layer would mean migrating it later.
- **A light theme or a theme switch.** It's a desk tool used mostly in the evening. One theme halves the contrast work.
- **Fonts from Google Fonts.** That would be an outside request on every visit and a privacy leak. Self-hosting costs a few hundred kB once, served from CloudFront.

## Consequences

- `apps/web/src/styles.css` holds the only colour definitions. A hex value or an old token (`alert`, `amber`, `ok`) in a component is a review finding.
- New dependencies are pinned to exact versions and pass `minimumReleaseAge`: `@base-ui/react`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` and `@fontsource/ibm-plex-sans`.
- The JS bundle grows (Base UI, fonts). Splitting it per route is left until it matters.
- The #71 slice goes in five PRs on this foundation: Radar, then Stream, Threads and Inbox.
- `CONTEXT.md`: Radar replaces Briefing; Stream filters replace the Region and Topic pages; Inbox is added.
