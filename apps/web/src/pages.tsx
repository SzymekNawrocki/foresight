import type { AnalyzedEvent, Topic } from "@foresight/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fetchRecent } from "./api.js";
import { EventCard } from "./EventCard.js";
import { briefing, type ThreadMove, threadBriefing } from "./intel.js";
import { REGION_LABEL, TOPIC_LABEL } from "./labels.js";
import { LoadError, PageHeader, Panel } from "./panel.js";
import type { StreamSearch } from "./router.js";
import { useSession } from "./session.js";
import { ThreadList, ThreadsPanel, useProposals, useThreads } from "./threads.js";
import { When } from "./time.js";
import { Loading } from "./ui/skeleton.js";
import { WorldMap } from "./WorldMap.js";

export function useRecent() {
  return useQuery({ queryKey: ["recent"], queryFn: fetchRecent, refetchInterval: 5 * 60_000 });
}

function Status({ query, children }: { query: ReturnType<typeof useRecent>; children: (events: AnalyzedEvent[]) => ReactNode }) {
  if (query.isPending) return <Loading label="Ładuję Zdarzenia" />;
  if (query.isError) return <LoadError what="Zdarzeń" retry={query.refetch} />;
  return children(query.data.events);
}

function EventStream({ events, empty }: { events: AnalyzedEvent[]; empty: string }) {
  if (events.length === 0) return <p className="text-dim">{empty}</p>;
  return (
    <ol className="grid gap-3">
      {events.map((e) => (
        <li key={e.id}>
          <EventCard event={e} />
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value, tone = "text-fg" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <dt className="label">{label}</dt>
      <dd className={`data text-[26px] leading-tight font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function MoveLine({ item }: { item: ThreadMove }) {
  const { move } = item;
  return (
    <li className="border-b border-line py-2 last:border-b-0">
      <span className="text-[13px] text-dim">
        <When iso={item.at} />
        {" · "}
      </span>
      <Link to="/thread/$id" params={{ id: item.thread.id }} className="font-medium">
        {item.thread.name}
      </Link>
      {": "}
      {move.kind === "shift" ? (
        <>
          {`${move.scenario} — ${move.from} → `}
          <strong className="font-medium text-brass">{move.to}</strong>
        </>
      ) : (
        <>
          <span className="text-brass" aria-hidden>
            ●{" "}
          </span>
          {`zapalił się sygnał „${move.text}” (${move.scenario})`}
        </>
      )}
    </li>
  );
}

function InboxShortcut() {
  const token = useSession();
  const proposals = useProposals(Boolean(token));
  const count = proposals.data?.proposals.length ?? 0;
  if (!token || count === 0) return null;
  return (
    <Link to="/inbox" className="flex items-center justify-between rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 no-underline">
      <span>{`Nowe sytuacje czekają na decyzję: ${count}`}</span>
      <span className="text-brass">Otwórz Skrzynkę →</span>
    </Link>
  );
}

// Radar (CONTEXT.md): Moves → map of Threads → active Threads; raw Events live on the Stream.
export function BriefingPage() {
  const threads = useThreads();
  const recent = useRecent();
  if (threads.isPending) return <Loading label="Ładuję Wątki" />;
  if (threads.isError) return <LoadError what="Wątków" retry={threads.refetch} />;
  const now = new Date();
  const b = threadBriefing(threads.data.threads, now);
  const events = recent.data ? briefing(recent.data.events, now).totals : null;
  return (
    <div className="grid gap-6">
      <PageHeader title="Radar" subtitle="Co dziś ważne w Niszy: ruchy w Wątkach, mapa i Wątki aktywne.">
        <dl className="ml-auto grid grid-cols-3 gap-2">
          <Stat label="Ruchy" value={b.moves.length} tone="text-brass" />
          <Stat label="Wątki aktywne" value={b.active.length} />
          <Stat label="Zdarzenia" value={events?.events ?? 0} tone="text-dim" />
        </dl>
      </PageHeader>

      <InboxShortcut />

      <Panel title="Ruchy · 24 h" aside="Zmiany Prawdopodobieństwa i zapalone sygnały">
        {b.moves.length === 0 ? (
          <p className="text-dim">Bez istotnych zmian w ostatnich 24 h.</p>
        ) : (
          <ul>
            {b.moves.map((m, i) => (
              <MoveLine key={`${m.thread.id}-${i}`} item={m} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Mapa Wątków" aside="Aktywne Wątki per Region">
        <WorldMap counts={b.regions} />
      </Panel>

      <ThreadsPanel />
    </div>
  );
}

const matches = (e: AnalyzedEvent, { region, topic }: StreamSearch) =>
  (!region || (e.analysis?.regions.includes(region) ?? false)) &&
  (!topic || ((e.analysis?.topics as readonly string[] | undefined)?.includes(topic) ?? false));

function FilterBar({ filter }: { filter: StreamSearch }) {
  const names = [filter.region && REGION_LABEL[filter.region], filter.topic && TOPIC_LABEL[filter.topic]].filter(Boolean);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brass/40 bg-brass/5 px-4 py-2">
      <span className="label">Filtr</span>
      <span className="font-medium text-brass">{names.join(" · ")}</span>
      <Link to="/stream" search={{}} className="ml-auto text-[14px]">
        Wyczyść filtr
      </Link>
    </div>
  );
}

function RegionThreads({ region }: { region: NonNullable<StreamSearch["region"]> }) {
  const threads = useThreads();
  const here = threads.data?.threads.filter((t) => !t.dormant && t.regions.includes(region)) ?? [];
  if (!threads.isSuccess) return null;
  return (
    <Panel title="Wątki w tym Regionie">
      {here.length === 0 ? <p className="text-dim">Brak aktywnych Wątków.</p> : <ThreadList threads={here} />}
    </Panel>
  );
}

/** Strumień: every Niche Event, for those who want to look under the Threads. */
export function StreamPage({ filter }: { filter: StreamSearch }) {
  const recent = useRecent();
  const filtered = Boolean(filter.region || filter.topic);
  return (
    <div className="grid gap-6">
      <PageHeader title="Strumień" subtitle="Wszystkie Zdarzenia z Niszy: mapa, Tematy i pełna lista meldunków." />
      <Status query={recent}>
        {(events) => {
          if (filtered) {
            return (
              <>
                <FilterBar filter={filter} />
                {filter.region && <RegionThreads region={filter.region} />}
                <Panel title="Zdarzenia · od najnowszych">
                  <EventStream events={events.filter((e) => matches(e, filter))} empty="Brak Zdarzeń z tym filtrem w ostatnich 72 h." />
                </Panel>
              </>
            );
          }
          const b = briefing(events, new Date());
          return (
            <>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Zdarzenia · 24 h" value={b.totals.events} />
                <Stat label="Istotne" value={b.totals.significant} tone="text-copper" />
                <Stat label="Przełomowe" value={b.totals.breakthrough} tone="text-coral" />
                <Stat label="Bez Analizy" value={b.totals.pending} tone="text-dim" />
              </dl>

              <Panel title="Mapa" aside="Zdarzenia z Wagą ≥ 2, ostatnie 24 h">
                <WorldMap counts={b.regions} />
              </Panel>

              <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
                <Panel title="Najważniejsze meldunki">
                  <EventStream events={b.top.slice(0, 8)} empty="Brak istotnych Zdarzeń w ostatnich 24 h." />
                </Panel>
                <Panel title="Tematy · 24 h">
                  <ul className="grid gap-1">
                    {(Object.entries(b.topics) as [Topic, number][]).map(([t, n]) => (
                      <li key={t}>
                        <Link to="/stream" search={{ topic: t }} className="flex justify-between border-b border-line py-1.5 no-underline">
                          <span>{TOPIC_LABEL[t]}</span>
                          <strong className={`data ${n ? "text-brass" : "text-faint"}`}>{n}</strong>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>

              <Panel title="Najnowsze">
                <EventStream events={events.slice(0, 20)} empty="Brak Zdarzeń." />
              </Panel>
            </>
          );
        }}
      </Status>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div>
      <p className="label text-coral">Błąd 404</p>
      <h1 className="text-[28px] font-semibold">Brak takich akt</h1>
      <p className="mt-1 text-dim">Ten adres nie prowadzi do żadnego Wątku ani widoku.</p>
      <Link to="/" className="mt-3 inline-block text-brass">
        ← Wróć na Radar
      </Link>
    </div>
  );
}
