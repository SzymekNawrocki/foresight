import type { Region } from "@foresight/shared";
import { geoCentroid, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110m from "world-atlas/countries-110m.json";
import { regionOfCountry } from "./intel.js";

export const WIDTH = 960;
export const HEIGHT = 480;

type Country = Feature<Geometry, { name: string }>;

// Granice państw z Natural Earth (pakiet world-atlas, w bundlu) — bez zapytań do obcych serwerów.
const topology = countries110m as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const world = feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>;
export const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [WIDTH - 8, HEIGHT - 8],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);

export const shapes = world.features.flatMap((country: Country) => {
  const region = regionOfCountry(country.properties.name, geoCentroid(country) as [number, number]);
  const d = path(country);
  return region && d ? [{ name: country.properties.name, region, d }] : [];
});
export const graticule = path(geoGraticule10()) ?? "";
export const sphere = path({ type: "Sphere" }) ?? "";

export type MapRegion = Exclude<Region, "global">;

// Gdzie stoi etykieta Regionu: [długość, szerokość].
export const ANCHOR: Record<MapRegion, [number, number]> = {
  "north-america": [-102, 47],
  "latin-america": [-62, -14],
  europe: [12, 50],
  "russia-eurasia": [85, 58],
  "middle-east": [46, 27],
  africa: [20, 4],
  "asia-pacific": [118, 12],
};

export const MAP_REGIONS = Object.keys(ANCHOR) as MapRegion[];

/** SVG point of a Region's anchor. */
export const anchorOf = (region: MapRegion): [number, number] => projection(ANCHOR[region]) ?? [0, 0];

/** Fill opacity of a Region by its Event count. */
export const heat = (count: number) => (count === 0 ? 0.05 : Math.min(0.18 + count * 0.08, 0.7));
