import type { AnalyzedEvent, Region, Topic } from "@foresight/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fetchRecent } from "./api.js";
import { EventCard } from "./EventCard.js";
import { briefing, type ThreadMove, threadBriefing } from "./intel.js";
import { REGION_LABEL, TOPIC_LABEL } from "./labels.js";
import { Panel } from "./panel.js";
import { InboxPanel, ThreadList, ThreadsPanel, useThreads } from "./threads.js";
import { WorldMap } from "./WorldMap.js";

export function useRecent() {
  return useQuery({ queryKey: ["recent"], queryFn: fetchRecent, refetchInterval: 5 * 60_000 });
}

function Status({ query, children }: { query: ReturnType<typeof useRecent>; children: (events: AnalyzedEvent[]) => ReactNode }) {
  if (query.isPending) return <p className="label">Odszyfrowuję meldunki<span className="blink">_</span></p>;
  if (query.isError) return <p className="label text-alert">Nie udało się pobrać Zdarzeń.</p>;
  return children(query.data.events);
}

function EventStream({ events, empty }: { events: AnalyzedEvent[]; empty: string }) {
  if (events.length === 0) return <p className="label">{empty}</p>;
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
    <div className="border border-line bg-panel/60 px-3 py-2">
      <dt className="label text-[10px]">{label}</dt>
      <dd className={`font-display text-3xl font-bold ${tone}`}>{String(value).padStart(2, "0")}</dd>
    </div>
  );
}

const time = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" });

function MoveLine({ item }: { item: ThreadMove }) {
  const { move } = item;
  return (
    <li className="border-b border-line/60 py-1.5 text-[13px]">
      <span className="text-[11px] text-dim">
        <time dateTime={item.at}>{time.format(new Date(item.at))}</time>
        {" · "}
      </span>
      <Link to="/thread/$id" params={{ id: item.thread.id }} className="font-medium">
        {item.thread.name}
      </Link>
      {": "}
      {move.kind === "shift" ? (
        <>
          {`${move.scenario} — ${move.from} → `}
          <strong className="text-alert">{move.to}</strong>
        </>
      ) : (
        <>
          <span className="text-alert">● </span>
          {`zapalił się sygnał „${move.text}” (${move.scenario})`}
        </>
      )}
    </li>
  );
}

// Briefing (CONTEXT.md): Moves → map of Threads → active Threads; raw Events live on the Stream.
export function BriefingPage() {
  const threads = useThreads();
  const recent = useRecent();
  if (threads.isPending) return <p className="label">Odszyfrowuję Wątki<span className="blink">_</span></p>;
  if (threads.isError) return <p className="label text-alert">Nie udało się pobrać Wątków.</p>;
  const now = new Date();
  const b = threadBriefing(threads.data.threads, now);
  const events = recent.data ? briefing(recent.data.events, now).totals : null;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="font-display text-3xl font-bold tracking-[0.12em] uppercase">Briefing · 24 h</h1>
        <dl className="ml-auto grid grid-cols-3 gap-2">
          <Stat label="Ruchy" value={b.moves.length} tone="text-alert" />
          <Stat label="Wątki aktywne" value={b.active.length} />
          <Stat label="Zdarzenia" value={events?.events ?? 0} tone="text-dim" />
        </dl>
      </div>

      <InboxPanel />

      <Panel title="Ruchy · 24 h" aside="Zmiany Prawdopodobieństwa i zapalone sygnały">
        {b.moves.length === 0 ? (
          <p className="label">Bez istotnych zmian w ostatnich 24 h.</p>
        ) : (
          <ul>
            {b.moves.map((m, i) => (
              <MoveLine key={`${m.thread.id}-${i}`} item={m} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Teatr działań" aside="Aktywne Wątki per Region">
        <WorldMap counts={b.regions} />
        <Link to="/region/$region" params={{ region: "global" }} className="tag mt-3 inline-flex gap-3 px-3 py-1.5">
          <span className="label text-fg">{REGION_LABEL.global}</span>
          <strong className={b.regions.global ? "text-alert" : "text-faint"}>{String(b.regions.global).padStart(2, "0")}</strong>
        </Link>
      </Panel>

      <ThreadsPanel />
    </div>
  );
}

/** Strumień: every Event of the last 24 h, for those who want to look under the Threads. */
export function StreamPage() {
  const recent = useRecent();
  return (
    <Status query={recent}>
      {(events) => {
        const b = briefing(events, new Date());
        return (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-end gap-4">
              <h1 className="font-display text-3xl font-bold tracking-[0.12em] uppercase">Strumień · 24 h</h1>
              <dl className="ml-auto grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Zdarzenia" value={b.totals.events} />
                <Stat label="Istotne" value={b.totals.significant} tone="text-amber" />
                <Stat label="Przełomowe" value={b.totals.breakthrough} tone="text-alert" />
                <Stat label="Bez Analizy" value={b.totals.pending} tone="text-dim" />
              </dl>
            </div>

            <Panel title="Teatr działań" aside="Zdarzenia z Wagą ≥ 2, ostatnie 24 h">
              <WorldMap counts={b.regions} />
              <Link
                to="/region/$region"
                params={{ region: "global" }}
                className="tag mt-3 inline-flex gap-3 px-3 py-1.5"
              >
                <span className="label text-fg">{REGION_LABEL.global}</span>
                <strong className={b.regions.global ? "text-alert" : "text-faint"}>{String(b.regions.global).padStart(2, "0")}</strong>
              </Link>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
              <Panel title="Najważniejsze meldunki">
                <EventStream events={b.top.slice(0, 8)} empty="Brak istotnych Zdarzeń w ostatnich 24 h." />
              </Panel>
              <Panel title="Tematy · 24 h">
                <ul className="grid gap-1">
                  {(Object.entries(b.topics) as [Topic, number][]).map(([t, n]) => (
                    <li key={t}>
                      <Link to="/topic/$topic" params={{ topic: t }} className="flex justify-between border-b border-line/60 py-1.5 no-underline">
                        <span>{TOPIC_LABEL[t]}</span>
                        <strong className={n ? "text-alert" : "text-faint"}>{String(n).padStart(2, "0")}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>

            <Panel title="Strumień · najnowsze">
              <EventStream events={events.slice(0, 20)} empty="Brak Zdarzeń." />
            </Panel>
          </div>
        );
      }}
    </Status>
  );
}

function Dossier({ kind, name, events, children }: { kind: string; name: string; events: AnalyzedEvent[]; children?: ReactNode }) {
  const significant = events.filter((e) => (e.analysis?.weight ?? 0) >= 2).length;
  return (
    <div className="grid gap-6">
      <div>
        <p className="label text-alert">Dossier · {kind}</p>
        <h1 className="font-display text-4xl font-bold tracking-[0.1em] uppercase">{name}</h1>
        <p className="mt-1 text-dim">
          {events.length} Zdarzeń z 72 h, w tym {significant} z Wagą ≥ 2.
        </p>
      </div>
      {children}
      <Panel title="Zdarzenia · od najnowszych">
        <EventStream events={events} empty="Brak Zdarzeń w tym obszarze w ostatnich 72 h." />
      </Panel>
    </div>
  );
}

function RegionThreads({ region }: { region: Region }) {
  const threads = useThreads();
  const here = threads.data?.threads.filter((t) => !t.dormant && t.regions.includes(region)) ?? [];
  if (!threads.isSuccess) return null;
  return (
    <Panel title="Wątki w tym Regionie">
      {here.length === 0 ? <p className="label">Brak aktywnych Wątków.</p> : <ThreadList threads={here} />}
    </Panel>
  );
}

export function RegionPage({ region }: { region: Region }) {
  const recent = useRecent();
  return (
    <Status query={recent}>
      {(events) => (
        <Dossier
          kind="Region"
          name={REGION_LABEL[region]}
          events={events.filter((e) => e.analysis?.regions.includes(region))}
        >
          <RegionThreads region={region} />
        </Dossier>
      )}
    </Status>
  );
}

export function TopicPage({ topic }: { topic: Topic }) {
  const recent = useRecent();
  return (
    <Status query={recent}>
      {(events) => (
        <Dossier
          kind="Temat"
          name={TOPIC_LABEL[topic]}
          events={events.filter((e) => e.analysis?.topics.includes(topic))}
        />
      )}
    </Status>
  );
}

export function NotFoundPage() {
  return (
    <div>
      <p className="label text-alert">Błąd 404</p>
      <h1 className="font-display text-3xl font-bold uppercase">Brak takich akt</h1>
      <Link to="/" className="mt-3 inline-block">
        ← Wróć do Briefingu
      </Link>
    </div>
  );
}

