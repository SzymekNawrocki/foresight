import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { anchorOf, graticule, HEIGHT, heat, MAP_REGIONS, type MapRegion, shapes, sphere, WIDTH } from "./geo.js";
import type { Theatre, TheatreMarker } from "./intel.js";
import { REGION_LABEL } from "./labels.js";
import { Card } from "./ui/card.js";

// Where the n-th Thread of a Region sits around its anchor, in SVG units; the leader line runs from the anchor.
const OFFSETS: [number, number][] = [
  [-78, -46],
  [78, -46],
  [-92, 34],
  [92, 34],
  [0, -74],
  [0, 62],
  [-150, -6],
  [150, -6],
];

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function placed(markers: readonly TheatreMarker[]) {
  const seen = new Map<MapRegion, number>();
  return markers.map((m) => {
    const i = seen.get(m.region) ?? 0;
    seen.set(m.region, i + 1);
    const [ax, ay] = anchorOf(m.region);
    const [dx, dy] = OFFSETS[i % OFFSETS.length] ?? [0, 0];
    const ring = 1 + Math.floor(i / OFFSETS.length) * 0.6;
    return { ...m, ax, ay, x: clamp(ax + dx * ring, 48, WIDTH - 48), y: clamp(ay + dy * ring, 20, HEIGHT - 20) };
  });
}

const pct = (x: number, y: number) => ({ left: `${(x / WIDTH) * 100}%`, top: `${(y / HEIGHT) * 100}%` });

/** "13:15Z" — the time of the newest data, in UTC like an operations log. */
export const zulu = (iso: string) => `${iso.slice(11, 16)}Z`;

/**
 * The Radar's theatre (ADR 0013): Regions tinted in amber by Niche Events of the last 24 h,
 * a calm critical pulse over a Region with a Breakthrough, and every active Thread as a
 * `W-NN` marker on a leader line. `lit` is the Thread hovered here or in the lists beside it.
 */
export function TheatreMap({
  theatre,
  lit,
  onLight,
  updatedAt,
}: {
  theatre: Theatre;
  lit: string | null;
  onLight: (id: string | null) => void;
  updatedAt?: string | undefined;
}) {
  const id = useId();
  const markers = placed(theatre.markers);
  return (
    <section aria-labelledby={id}>
      <Card className="frame-lg frame-bg">
        <div className="relative aspect-[2/1] w-full">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block size-full" role="img" aria-label="Mapa Regionów i aktywnych Wątków">
            <path d={sphere} className="fill-bg stroke-border" />
            <path d={graticule} className="fill-none stroke-raised" strokeWidth={0.6} />
            {shapes.map((s) => (
              <path
                key={s.name}
                d={s.d}
                fill="var(--color-amber)"
                fillOpacity={heat(theatre.regions[s.region].events)}
                className="stroke-border"
                strokeWidth={0.4}
              />
            ))}
            {markers.map((m) => (
              <line
                key={m.id}
                x1={m.ax}
                y1={m.ay}
                x2={m.x}
                y2={m.y}
                strokeWidth={lit === m.id ? 1.4 : 0.8}
                className={`transition-colors ${lit === m.id ? "stroke-amber" : "stroke-faint"}`}
              />
            ))}
            {MAP_REGIONS.filter((r) => theatre.regions[r].breakthrough).map((r) => {
              const [x, y] = anchorOf(r);
              return (
                <g key={r} aria-hidden>
                  <circle cx={x} cy={y} r={9} className="animate-pulse-marker fill-none stroke-critical [transform-box:fill-box] [transform-origin:center]" strokeWidth={1.5} />
                  <circle cx={x} cy={y} r={3.5} className="fill-critical" />
                </g>
              );
            })}
          </svg>

          <h2 id={id} className="label absolute top-3 left-5 text-fg">
            Teatr działań · 24 h
          </h2>
          {updatedAt && <p className="data absolute top-3 right-4 hidden text-xs text-muted sm:block">{`STAN ${zulu(updatedAt)}`}</p>}

          <div role="group" aria-label="Regiony" className="hidden md:block">
            {MAP_REGIONS.map((r) => {
              const [x, y] = anchorOf(r);
              const { events: count } = theatre.regions[r];
              return (
                <Link
                  key={r}
                  to="/stream"
                  search={{ region: r }}
                  aria-label={`${REGION_LABEL[r]}: ${count} w 24 h${theatre.regions[r].breakthrough ? ", w tym Przełomowe" : ""}`}
                  className="absolute flex -translate-x-1/2 translate-y-2 items-baseline gap-1.5 px-1 whitespace-nowrap no-underline hover:no-underline"
                  style={pct(x, y)}
                >
                  <span className="text-xs font-medium text-muted">{REGION_LABEL[r]}</span>
                  <span className={`data text-xs font-semibold ${count ? "text-amber" : "text-faint"}`}>{count}</span>
                </Link>
              );
            })}
          </div>

          <ul aria-label="Wątki na mapie" className="hidden md:block">
            {markers.map((m) => {
              const on = lit === m.id;
              return (
                <li key={m.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={pct(m.x, m.y)}>
                  <Link
                    to="/thread/$id"
                    params={{ id: m.id }}
                    aria-label={`${m.code} ${m.name}`}
                    onMouseEnter={() => onLight(m.id)}
                    onMouseLeave={() => onLight(null)}
                    onFocus={() => onLight(m.id)}
                    onBlur={() => onLight(null)}
                    className={`frame frame-sm frame-bg flex items-center gap-1.5 px-1.5 py-0.5 whitespace-nowrap no-underline hover:no-underline ${
                      on ? "frame-accent text-amber" : "text-fg"
                    }`}
                  >
                    <span aria-hidden className={`size-1.5 rotate-45 ${m.hot ? "bg-critical" : m.newEvents ? "bg-amber" : "bg-faint"}`} />
                    <span className="data text-xs font-semibold">{m.code}</span>
                    {on && <span className="max-w-56 truncate text-xs">{m.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="data absolute bottom-3 left-5 hidden gap-4 text-xs text-muted lg:flex">
            <span>
              <span aria-hidden className="mr-1.5 inline-block size-1.5 rotate-45 bg-amber" />
              nowe Zdarzenia
            </span>
            <span>
              <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-critical" />
              Przełom
            </span>
          </p>
          <p className="data absolute right-4 bottom-3 hidden text-xs text-muted sm:block">{`WĄTKI ${theatre.markers.length} · ZDARZENIA ${theatre.events}`}</p>
        </div>
      </Card>
    </section>
  );
}
