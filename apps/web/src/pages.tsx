import type { AnalyzedEvent, Region, Thesis, Topic } from "@foresight/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { fetchRecent } from "./api.js";
import { EventCard } from "./EventCard.js";
import { briefing } from "./intel.js";
import { REGION_LABEL, TOPIC_LABEL } from "./labels.js";
import { accuracy, score, type Tally } from "./score.js";
import { ThesisList, useTheses } from "./theses.js";
import { WorldMap } from "./WorldMap.js";
import { useSession } from "./session.js";

function useRecent() {
  return useQuery({ queryKey: ["recent"], queryFn: fetchRecent, refetchInterval: 5 * 60_000 });
}

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border border-line bg-panel/60">
      <h2 className="label flex items-center gap-2 border-b border-line px-3 py-2 text-fg">
        <span className="text-alert">■</span>
        {title}
        {aside && <span className="ml-auto text-dim normal-case tracking-normal">{aside}</span>}
      </h2>
      <div className="p-3">{children}</div>
    </section>
  );
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

export function BriefingPage() {
  const recent = useRecent();
  return (
    <Status query={recent}>
      {(events) => {
        const b = briefing(events, new Date());
        return (
          <div className="grid gap-6">
            <div className="flex flex-wrap items-end gap-4">
              <h1 className="font-display text-3xl font-bold tracking-[0.12em] uppercase">Briefing · 24 h</h1>
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

function Dossier({ kind, name, events, inArea }: { kind: string; name: string; events: AnalyzedEvent[]; inArea: (t: Thesis) => boolean }) {
  const token = useSession();
  const theses = useTheses();
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
      {token && (
        <Panel title="Moje Tezy w tym obszarze" aside={theses.data ? `trafność ${accuracy(score(theses.data.theses.filter(inArea)).overall)}` : undefined}>
          {theses.data ? <ThesisList theses={theses.data.theses.filter(inArea)} empty="Brak Tez w tym obszarze." /> : <p className="label">Wczytuję Tezy…</p>}
        </Panel>
      )}
      <Panel title="Zdarzenia · od najnowszych">
        <EventStream events={events} empty="Brak Zdarzeń w tym obszarze w ostatnich 72 h." />
      </Panel>
    </div>
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
          inArea={(t) => t.regions.includes(region)}
        />
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
          inArea={(t) => t.topics.includes(topic)}
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

export function ThesesPage() {
  const token = useSession();
  const theses = useTheses();
  if (!token) return <p className="label">Zaloguj się, żeby zobaczyć swoje Tezy.</p>;
  return (
    <div className="grid gap-6">
      <div>
        <p className="label text-alert">Ściśle prywatne</p>
        <h1 className="font-display text-4xl font-bold tracking-[0.1em] uppercase">Moje Tezy</h1>
        <p className="mt-1 text-dim">Tezę stawiasz pod Zdarzeniem — przyciskiem „Postaw Tezę” na jego aktach.</p>
      </div>
      {theses.data && <ScorePanel theses={theses.data.theses} />}
      <Panel title="Tezy · od najnowszych">
        {theses.isError ? (
          <p className="label text-alert">Nie udało się pobrać Tez.</p>
        ) : theses.data ? (
          <ThesisList theses={theses.data.theses} empty="Nie masz jeszcze żadnej Tezy." />
        ) : (
          <p className="label">Wczytuję Tezy…</p>
        )}
      </Panel>
    </div>
  );
}

function TallyRows<K extends string>({ title, tallies, label }: { title: string; tallies: Record<K, Tally>; label: Record<K, string> }) {
  const rows = (Object.entries(tallies) as [K, Tally][]).filter(([, t]) => t.resolved + t.open > 0);
  return (
    <div>
      <h3 className="label mb-2 text-fg">{title}</h3>
      {rows.length === 0 ? (
        <p className="label">—</p>
      ) : (
        <table className="w-full text-left">
          <tbody>
            {rows.map(([key, t]) => (
              <tr key={key} className="border-b border-line/60">
                <th scope="row" className="py-1.5 font-normal">
                  {label[key]}
                </th>
                <td className="py-1.5 text-right text-dim">
                  {t.hits}/{t.resolved}
                </td>
                <td className="w-16 py-1.5 text-right font-bold">{accuracy(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ScorePanel({ theses }: { theses: Thesis[] }) {
  const s = score(theses);
  return (
    <Panel title="Wynik" aside="Trafione / Rozstrzygnięte">
      <dl className="grid grid-cols-3 gap-2">
        <div className="border border-line px-3 py-2">
          <dt className="label text-[10px]">Trafność</dt>
          <dd className="font-display text-3xl font-bold text-alert">{accuracy(s.overall)}</dd>
        </div>
        <Stat label="Rozstrzygnięte" value={s.overall.resolved} />
        <Stat label="Otwarte" value={s.overall.open} tone="text-amber" />
      </dl>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <TallyRows title="Per Temat" tallies={s.topics} label={TOPIC_LABEL} />
        <TallyRows title="Per Region" tallies={s.regions} label={REGION_LABEL} />
      </div>
    </Panel>
  );
}
