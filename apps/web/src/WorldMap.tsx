import { Region } from "@foresight/shared";
import { useNavigate } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import type { StreamSearch } from "./filters.js";
import { ANCHOR, graticule, HEIGHT, heat, MAP_REGIONS, projection, shapes, sphere, WIDTH } from "./geo.js";
import { REGION_LABEL } from "./labels.js";

/** Toggles the Region filter: a second click on the same Region clears it. */
const toggle =
  (region: Region) =>
  (prev: StreamSearch): StreamSearch => ({ ...prev, region: prev.region === region ? undefined : region });

function Count({ region, count, breakthrough }: { region: Region; count: number; breakthrough: boolean }) {
  return (
    <>
      <span className="text-xs font-medium text-fg">{REGION_LABEL[region]}</span>
      <span className={`data text-xs font-semibold ${count ? "text-amber" : "text-faint"}`}>{count}</span>
      {breakthrough && (
        <>
          <Zap className="size-3 fill-critical text-critical" aria-hidden />
          <span className="sr-only">w tym Przełomowe</span>
        </>
      )}
    </>
  );
}

const label = (region: Region, count: number, breakthrough: boolean) =>
  `${REGION_LABEL[region]}: ${count}${breakthrough ? ", w tym Przełomowe" : ""}`;

const pill =
  "flex min-h-6 items-center gap-1.5 border bg-bg px-2 py-0.5 whitespace-nowrap transition-colors hover:border-amber aria-pressed:bg-amber-wash";

/**
 * Map of the Stream (#71): Regions tinted in amber by Event count, a critical mark where a
 * Breakthrough Event is. A click sets the Region filter, a second click clears it;
 * on small screens a select takes over from the labels.
 */
export function WorldMap({
  counts,
  breakthrough,
  selected,
}: {
  counts: Record<Region, number>;
  breakthrough: Record<Region, boolean>;
  selected?: Region | undefined;
}) {
  const navigate = useNavigate({ from: "/stream" });
  return (
    <div className="grid gap-3">
      <div className="frame frame-lg frame-bg brackets aspect-[2/1] w-full">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block size-full" role="img" aria-label="Mapa Regionów">
          <path d={sphere} className="fill-bg stroke-border" />
          <path d={graticule} className="fill-none stroke-raised" strokeWidth={0.5} />
          {shapes.map((s) => (
            <path
              key={s.name}
              d={s.d}
              data-region={s.region}
              fill="var(--color-amber)"
              fillOpacity={selected && selected !== s.region ? heat(counts[s.region]) / 3 : heat(counts[s.region])}
              className="cursor-pointer stroke-border"
              strokeWidth={0.4}
              onClick={() => void navigate({ search: toggle(s.region) })}
            />
          ))}
        </svg>
        <div role="group" aria-label="Regiony na mapie" className="hidden md:block">
          {MAP_REGIONS.map((region) => {
            const [x, y] = projection(ANCHOR[region]) ?? [0, 0];
            return (
              <button
                type="button"
                key={region}
                onClick={() => void navigate({ search: toggle(region) })}
                aria-pressed={selected === region}
                aria-label={label(region, counts[region], breakthrough[region])}
                className={`absolute -translate-x-1/2 -translate-y-1/2 ${pill} ${selected === region ? "border-amber" : "border-border"}`}
                style={{ left: `${(x / WIDTH) * 100}%`, top: `${(y / HEIGHT) * 100}%` }}
              >
                <Count region={region} count={counts[region]} breakthrough={breakthrough[region]} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void navigate({ search: toggle("global") })}
          aria-pressed={selected === "global"}
          aria-label={label("global", counts.global, breakthrough.global)}
          className={`${pill} ${selected === "global" ? "border-amber" : "border-border"}`}
        >
          <Count region="global" count={counts.global} breakthrough={breakthrough.global} />
        </button>
        <label className="flex items-center gap-2 text-base md:hidden">
          <span className="text-muted">Region</span>
          <select
            aria-label="Region"
            value={selected ?? ""}
            onChange={(e) => {
              const region = Region.safeParse(e.target.value);
              void navigate({ search: (prev: StreamSearch) => ({ ...prev, region: region.success ? region.data : undefined }) });
            }}
            className="h-11 border border-border-strong bg-bg px-2 hover:border-faint md:h-8"
          >
            <option value="">Wszystkie</option>
            {Region.options.map((r) => (
              <option key={r} value={r}>
                {`${REGION_LABEL[r]} (${counts[r]})`}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
