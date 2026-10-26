import { Region } from "@foresight/shared";
import { useNavigate } from "@tanstack/react-router";
import { geoCentroid, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { Zap } from "lucide-react";
import countries110m from "world-atlas/countries-110m.json";
import { regionOfCountry } from "./intel.js";
import type { StreamSearch } from "./filters.js";
import { REGION_LABEL } from "./labels.js";

const WIDTH = 960;
const HEIGHT = 480;

type Country = Feature<Geometry, { name: string }>;

// Granice państw z Natural Earth (pakiet world-atlas, w bundlu) — bez zapytań do obcych serwerów.
const topology = countries110m as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [WIDTH - 8, HEIGHT - 8],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);

const shapes = world.features.flatMap((country: Country) => {
  const region = regionOfCountry(country.properties.name, geoCentroid(country) as [number, number]);
  const d = path(country);
  return region && d ? [{ name: country.properties.name, region, d }] : [];
});
const graticule = path(geoGraticule10()) ?? "";
const sphere = path({ type: "Sphere" }) ?? "";

// Gdzie stoi etykieta Regionu: [długość, szerokość].
const ANCHOR: Record<Exclude<Region, "global">, [number, number]> = {
  "north-america": [-102, 47],
  "latin-america": [-62, -14],
  europe: [12, 50],
  "russia-eurasia": [85, 58],
  "middle-east": [46, 27],
  africa: [20, 4],
  "asia-pacific": [118, 12],
};

const heat = (count: number) => (count === 0 ? 0.05 : Math.min(0.18 + count * 0.08, 0.7));

const REGIONS = Object.keys(ANCHOR) as (keyof typeof ANCHOR)[];

/** Toggles the Region filter: a second click on the same Region clears it. */
const toggle =
  (region: Region) =>
  (prev: StreamSearch): StreamSearch => ({ ...prev, region: prev.region === region ? undefined : region });

function Count({ region, count, breakthrough }: { region: Region; count: number; breakthrough: boolean }) {
  return (
    <>
      <span className="text-[11px] font-medium text-fg">{REGION_LABEL[region]}</span>
      <span className={`data text-[12px] font-semibold ${count ? "text-brass" : "text-faint"}`}>{count}</span>
      {breakthrough && (
        <>
          <Zap className="size-3 fill-coral text-coral" aria-hidden />
          <span className="sr-only">w tym Przełomowe</span>
        </>
      )}
    </>
  );
}

const pill =
  "flex items-center gap-1.5 rounded-full border bg-bg/85 px-2 py-0.5 whitespace-nowrap backdrop-blur-sm hover:border-brass";

/**
 * Map of the Stream (#71): Regions tinted in brass by Event count, a coral mark where a
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
      <div className="relative mx-auto aspect-[2/1] h-[160px] max-w-full md:h-[240px]">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block size-full" role="img" aria-label="Mapa Regionów">
          <path d={sphere} className="fill-bg stroke-line" />
          <path d={graticule} className="fill-none stroke-line/50" strokeWidth={0.5} />
          {shapes.map((s) => (
            <path
              key={s.name}
              d={s.d}
              data-region={s.region}
              fill="var(--color-brass)"
              fillOpacity={selected && selected !== s.region ? heat(counts[s.region]) / 3 : heat(counts[s.region])}
              className="cursor-pointer stroke-line"
              strokeWidth={0.4}
              onClick={() => void navigate({ search: toggle(s.region) })}
            />
          ))}
        </svg>
        <div role="group" aria-label="Regiony na mapie" className="hidden md:block">
          {REGIONS.map((region) => {
            const [x, y] = projection(ANCHOR[region]) ?? [0, 0];
            return (
              <button
                type="button"
                key={region}
                onClick={() => void navigate({ search: toggle(region) })}
                aria-pressed={selected === region}
                className={`absolute -translate-x-1/2 -translate-y-1/2 ${pill} ${selected === region ? "border-brass" : "border-line"}`}
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
          className={`${pill} ${selected === "global" ? "border-brass" : "border-line"}`}
        >
          <Count region="global" count={counts.global} breakthrough={breakthrough.global} />
        </button>
        <label className="flex items-center gap-2 text-[14px] md:hidden">
          <span className="text-dim">Region</span>
          <select
            aria-label="Region"
            value={selected ?? ""}
            onChange={(e) => {
              const region = Region.safeParse(e.target.value);
              void navigate({ search: (prev: StreamSearch) => ({ ...prev, region: region.success ? region.data : undefined }) });
            }}
            className="h-8 rounded-md border border-line bg-surface px-2"
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
