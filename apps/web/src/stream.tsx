import { type AnalyzedEvent, Region, Topic } from "@foresight/shared";
import { useNavigate } from "@tanstack/react-router";
import { EventCard } from "./EventCard.js";
import { matches, type StreamSearch, topicsOf } from "./filters.js";
import { TOPIC_LABEL } from "./labels.js";
import { useRecent } from "./pages.js";
import { LoadError, PageHeader, Panel } from "./panel.js";
import { ThreadList, useThreads } from "./threads.js";
import { Button } from "./ui/button.js";
import { Loading } from "./ui/skeleton.js";
import { Toggle, ToggleGroup } from "./ui/toggle-group.js";
import { WorldMap } from "./WorldMap.js";

/** "1 Zdarzenie", "3 Zdarzenia", "5 Zdarzeń", "22 Zdarzenia". */
export function eventsCount(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (n === 1) return "1 Zdarzenie";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} Zdarzenia`;
  return `${n} Zdarzeń`;
}

const zeros = <V,>(value: V) => Object.fromEntries(Region.options.map((r) => [r, value])) as Record<Region, V>;

/** Per Region: Events passing the Topic and Weight filters, and whether one of them is a Breakthrough. */
function mapCounts(events: readonly AnalyzedEvent[], filter: StreamSearch) {
  const counts = zeros(0);
  const breakthrough = zeros(false);
  for (const e of events) {
    if (!e.analysis || !matches(e, filter, true)) continue;
    for (const r of e.analysis.regions) {
      counts[r]++;
      if (e.analysis.weight === 3) breakthrough[r] = true;
    }
  }
  return { counts, breakthrough };
}

const WEIGHTS = [
  { value: "all", label: "Wszystkie" },
  { value: "2", label: "Istotne i wyżej" },
  { value: "3", label: "Przełomowe" },
] as const;

function Filters({ filter }: { filter: StreamSearch }) {
  const navigate = useNavigate({ from: "/stream" });
  const topics = topicsOf(filter.topic);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label" id="filter-topics">
          Tematy
        </span>
        <ToggleGroup
          multiple
          aria-labelledby="filter-topics"
          value={topics}
          onValueChange={(value) => {
            const next = topicsOf(value.join(","));
            void navigate({ search: (prev: StreamSearch) => ({ ...prev, topic: next.length ? next.join(",") : undefined }) });
          }}
        >
          {Topic.options.map((t) => (
            <Toggle key={t} value={t}>
              {TOPIC_LABEL[t]}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label" id="filter-weight">
          Waga
        </span>
        <ToggleGroup
          aria-labelledby="filter-weight"
          value={[filter.weight ? String(filter.weight) : "all"]}
          onValueChange={([value]) => {
            const weight = value === "2" ? 2 : value === "3" ? 3 : undefined;
            void navigate({ search: (prev: StreamSearch) => ({ ...prev, weight }) });
          }}
        >
          {WEIGHTS.map((w) => (
            <Toggle key={w.value} value={w.value}>
              {w.label}
            </Toggle>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}

function RegionThreads({ region }: { region: Region }) {
  const threads = useThreads();
  const here = threads.data?.threads.filter((t) => !t.dormant && t.regions.includes(region)) ?? [];
  if (!threads.isSuccess || here.length === 0) return null;
  return (
    <Panel title="Wątki w tym Regionie">
      <ThreadList threads={here} />
    </Panel>
  );
}

/** Strumień: every Niche Event with the map; Region, Topics and Weight filter it in the browser. */
export function StreamPage({ filter }: { filter: StreamSearch }) {
  const recent = useRecent();
  const navigate = useNavigate({ from: "/stream" });
  return (
    <div className="grid gap-6">
      <PageHeader title="Strumień" subtitle="Wszystkie Zdarzenia z Niszy z ostatnich 72 h. Filtruj mapą, Tematem i Wagą." />
      {recent.isPending ? (
        <Loading label="Ładuję Zdarzenia" />
      ) : recent.isError ? (
        <LoadError what="Zdarzeń" retry={recent.refetch} />
      ) : (
        (() => {
          const events = recent.data.events;
          const shown = events.filter((e) => matches(e, filter));
          return (
            <>
              <WorldMap {...mapCounts(events, filter)} selected={filter.region} />
              <Filters filter={filter} />
              {filter.region && <RegionThreads region={filter.region} />}
              <p className="data text-dim" aria-live="polite">
                {eventsCount(shown.length)}
              </p>
              {shown.length === 0 ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-4">
                  <p className="text-dim">Żadne Zdarzenie nie pasuje do filtrów.</p>
                  <Button size="sm" onClick={() => void navigate({ search: {} })}>
                    Wyczyść filtry
                  </Button>
                </div>
              ) : (
                <ol aria-label="Zdarzenia" className="grid gap-3">
                  {shown.map((e) => (
                    <li key={e.id}>
                      <EventCard event={e} compact />
                    </li>
                  ))}
                </ol>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
