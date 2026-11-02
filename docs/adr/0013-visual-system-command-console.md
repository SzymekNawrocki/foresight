# Visual system: command console in amber

Supersedes the visual part of ADR 0011 (colours, type, corners). The component layer (shadcn/ui on Base UI, `lucide-react`, the four menu places, copy rules) stays.

Graphite and brass (ADR 0011) fixed the readability problems of the first "dossier" UI, but the owner found it did not say what Foresight is about: geostrategy and military technology. It also had no system below the colours: 7 hand-picked font sizes, two corner radii with no rule, shadows that barely show on a dark background, and 8 opacity tricks standing in for a stronger border. Decided in a design interview on 2026-11-02 (#87).

Key decisions:

- **Command console with near-future geometry.** It takes the structure of an operations-centre console (panel labels, mono data, Z times, corner brackets) and the geometry of a near-future HUD (chamfered corners, thin gauges). Dark theme only.
- **Cool near-black neutrals and one accent, amber `#e8a33d`.** Amber means important, active or changed: navigation, +N new, a lit signal, Weight 2 and the focus ring. Critical `#f2665a` means Weight 3 and Company ↓. Positive `#6fcf8a` means Company ↑ and the link is up. Brass, copper and coral go. Every text colour is at least 5:1 on every surface (checked with the WCAG relative-luminance formula on 2026-11-02).
- **Semantic aliases only.** Components use `bg`, `surface`, `raised`, `hover`, `border`, `border-strong`, `fg`, `muted`, `faint`, `ring` and the `*-wash` fills. The `n-*` scale exists only in `styles.css`. Tailwind's default palette and shadows are switched off (`--color-*: initial`, `--shadow-*: initial`), so a stray `text-red-500` or `shadow-lg` generates no CSS.
- **Chamfered frames instead of radii.** `frame` cuts the top-left and bottom-right corners (`--cut-sm` 6px buttons, `--cut-md` 10px panels, `--cut-lg` 16px map and dialogs). `clip-path` cuts borders and outlines too, so the frame is two layers: the element's background is the border colour and a `::before` 1px inside is the fill. Focus thickens the frame to 2px in amber. Full radius is left only for dots and map markers.
- **Type: Barlow, Barlow Condensed, JetBrains Mono.** Barlow (400/500/600) for text, Barlow Condensed for page titles, panel labels and the menu, JetBrains Mono for numbers, times, tickers and codes. 6 sizes: 12, 13, 14, 16, 20 and 28px. Only the Latin and Latin Extended subsets are loaded, self-hosted through `@fontsource`.
- **Compact density** on the 4px spacing scale, cards with 12px padding. Tap targets are 44px below the `md` breakpoint.
- **Functional motion only.** 150 ms colour transitions, a calm pulse over Weight 3 on the map and highlights between a list and the map. `prefers-reduced-motion` cuts it all.

What we keep from the lessons of ADR 0011: uppercase only in labels, never in body text; body text is 14px Barlow in sentence case; Z times sit next to data, with no ticking clock; one colour, one meaning, always with a word or an icon.

## Considered Options

- **Polish graphite and brass.** Brass reads as "premium", not "military technology", and the owner wanted a new direction.
- **Ice cyan accent.** It looks more "advanced", but it is the most common sci-fi UI colour and hard to make original.
- **Phosphor green.** Strong mood, tiring for a lot of text.
- **Defence-tech corporate (black, white, huge type).** Modern, but less of a tool to read every day.

## Consequences

- `apps/web/src/styles.css` is the only place for colours, sizes and corners. A hex value, `text-[Npx]`, a `/NN` opacity colour, a shadow or a `rounded-md/lg` in a component is a review finding.
- An element with `frame` must not also have `border` or `bg-*`: the frame is drawn by its background. Its colours are set with `frame-strong`, `frame-accent`, `frame-critical` (border) and `frame-raised`, `frame-hover`, `frame-wash`, `frame-alarm`, `frame-bg` (fill).
- The #87 slice goes in five PRs: this foundation, then Radar (2–3 variants of the map as the theatre in the centre), Threads, Stream and Inbox.
