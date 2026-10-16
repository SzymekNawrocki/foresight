import type { Region } from "@foresight/shared";
import { Link } from "@tanstack/react-router";
import { geoCentroid, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";
import { regionOfCountry } from "./intel.js";
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

const heat = (count: number) => (count === 0 ? 0.05 : Math.min(0.2 + count * 0.09, 0.75));

export function WorldMap({ counts }: { counts: Record<Region, number> }) {
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full" role="img" aria-label="Mapa Regionów">
        <path d={sphere} className="fill-panel stroke-line" />
        <path d={graticule} className="fill-none stroke-line/60" strokeWidth={0.5} />
        {shapes.map((s) => (
          <path
            key={s.name}
            d={s.d}
            data-region={s.region}
            fill="var(--color-alert)"
            fillOpacity={heat(counts[s.region])}
            className="stroke-faint/70"
            strokeWidth={0.4}
          />
        ))}
      </svg>
      <nav aria-label="Regiony na mapie" className="hidden md:block">
        {(Object.keys(ANCHOR) as (keyof typeof ANCHOR)[]).map((region) => {
          const [x, y] = projection(ANCHOR[region]) ?? [0, 0];
          return (
            <Link
              key={region}
              to="/region/$region"
              params={{ region }}
              className="absolute -translate-x-1/2 -translate-y-1/2 border border-line bg-ink/85 px-2 py-1 text-center whitespace-nowrap no-underline backdrop-blur-sm hover:border-alert hover:no-underline"
              style={{ left: `${(x / WIDTH) * 100}%`, top: `${(y / HEIGHT) * 100}%` }}
            >
              <span className="label block text-[10px] text-fg">{REGION_LABEL[region]}</span>
              <span className={`block text-base font-bold ${counts[region] ? "text-alert" : "text-faint"}`}>
                {String(counts[region]).padStart(2, "0")}
              </span>
            </Link>
          );
        })}
      </nav>
      <ul className="mt-3 grid grid-cols-2 gap-2 md:hidden">
        {(Object.keys(ANCHOR) as (keyof typeof ANCHOR)[]).map((region) => (
          <li key={region}>
            <Link to="/region/$region" params={{ region }} className="tag flex justify-between px-2 py-1.5">
              <span>{REGION_LABEL[region]}</span>
              <strong className={counts[region] ? "text-alert" : "text-faint"}>{String(counts[region]).padStart(2, "0")}</strong>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
