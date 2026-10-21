import type { ReportScenario, SituationReport, ThreadResponse, ThreadsResponse, TimelineEntry } from "@foresight/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { decideProposal, fetchProposals, fetchThread, fetchThreads } from "./api.js";
import { CHANGE_ARROW, REGION_LABEL, SCENARIO_LABEL, TIER_LABEL, WEIGHT_LABEL } from "./labels.js";
import { Panel } from "./panel.js";
import { useSession } from "./session.js";

const time = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" });
const stamp = (iso: string) => <time dateTime={iso}>{time.format(new Date(iso))}</time>;

const CHANGE_TONE = { up: "text-alert", down: "text-ok", same: "text-dim", new: "text-faint" } as const;

export function useThreads() {
  return useQuery({ queryKey: ["threads"], queryFn: fetchThreads, refetchInterval: 5 * 60_000 });
}

type ListedThread = ThreadsResponse["threads"][number];

function ThreadRow({ thread }: { thread: ListedThread }) {
  return (
    <li className="border-b border-line/60 py-2">
      <Link to="/thread/$id" params={{ id: thread.id }} className="font-display text-lg font-medium">
        {thread.name}
      </Link>
      <p className="text-[12px] text-dim">
        {thread.lead ? (
          <>
            <span className={CHANGE_TONE[thread.lead.change]}>{CHANGE_ARROW[thread.lead.change]}</span>{" "}
            {`Najbardziej prawdopodobne: ${thread.lead.scenario} — ${thread.lead.likelihood}`}
          </>
        ) : (
          "Raport sytuacyjny w przygotowaniu"
        )}
        {" · "}
        {`${thread.eventCount} Zdarzeń, ostatnie `}
        {stamp(thread.lastEventAt)}
        {thread.moves?.length ? ` · Ruchy: ${thread.moves.length}` : ""}
      </p>
    </li>
  );
}

export function ThreadsPanel() {
  const threads = useThreads();
  const active = threads.data?.threads.filter((t) => !t.dormant) ?? [];
  return (
    <Panel title="Wątki aktywne" aside="Zdarzenie w ostatnich 14 dniach">
      {threads.isPending ? (
        <p className="label">Ładuję Wątki…</p>
      ) : threads.isError ? (
        <p className="label text-alert">Nie udało się pobrać Wątków.</p>
      ) : active.length === 0 ? (
        <p className="label">Brak aktywnych Wątków — czekają w skrzynce Nowe sytuacje.</p>
      ) : (
        <ul>
          {active.map((t) => (
            <ThreadRow key={t.id} thread={t} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EntryLine({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="border-l-2 border-line py-1 pl-3 text-[13px]">
      <span className="text-[11px] text-dim">
        {stamp(entry.publishedAt)} · {entry.source} · Poziom {TIER_LABEL[entry.tier]} · Waga {entry.weight} ({WEIGHT_LABEL[entry.weight]})
      </span>
      <br />
      <a href={entry.url} target="_blank" rel="noopener noreferrer">
        {entry.title}
      </a>
      <p className="text-dim">{entry.whyItMatters}</p>
    </li>
  );
}

// Visible only to the owner; the API checks the token on every call anyway.
export function InboxPanel() {
  const token = useSession();
  if (!token) return null;
  return <Inbox />;
}

function Inbox() {
  const client = useQueryClient();
  const proposals = useQuery({ queryKey: ["proposals"], queryFn: fetchProposals });
  const threads = useThreads();
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: Parameters<typeof decideProposal>[1] }) => decideProposal(id, decision),
    onSuccess: async () => {
      setError(null);
      await Promise.all([client.invalidateQueries({ queryKey: ["proposals"] }), client.invalidateQueries({ queryKey: ["threads"] })]);
    },
    onError: () => setError("Decyzja nie przeszła — odśwież i spróbuj ponownie."),
  });
  const list = proposals.data?.proposals ?? [];
  const targets = threads.data?.threads ?? [];

  return (
    <Panel title={`Nowe sytuacje · ${list.length}`} aside="Akceptuj, połącz albo odrzuć">
      {proposals.isPending ? (
        <p className="label">Ładuję skrzynkę…</p>
      ) : proposals.isError ? (
        <p className="label text-alert">Nie udało się pobrać skrzynki.</p>
      ) : list.length === 0 ? (
        <p className="label">Skrzynka pusta.</p>
      ) : (
        <ul className="grid gap-4">
          {list.map(({ thread, timeline }) => (
            <li key={thread.id} className="border border-line p-3">
              <h3 className="font-display text-lg font-medium">{thread.name}</h3>
              <p className="text-[12px] text-dim">
                {`${thread.eventCount} Zdarzeń · ${thread.regions.map((r) => REGION_LABEL[r]).join(", ") || "bez Regionu"}`}
              </p>
              <ol className="mt-2 grid gap-1">
                {timeline.slice(0, 5).map((e) => (
                  <EntryLine key={e.eventId} entry={e} />
                ))}
              </ol>
              <MergeControls
                id={thread.id}
                targets={targets.filter((t) => t.id !== thread.id)}
                busy={decide.isPending}
                onDecide={(decision) => decide.mutate({ id: thread.id, decision })}
              />
            </li>
          ))}
        </ul>
      )}
      {error && <p className="label mt-2 text-alert">{error}</p>}
    </Panel>
  );
}

function MergeControls({
  id,
  targets,
  busy,
  onDecide,
}: {
  id: string;
  targets: ListedThread[];
  busy: boolean;
  onDecide: (decision: Parameters<typeof decideProposal>[1]) => void;
}) {
  const [into, setInto] = useState("");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} className="tag px-3 py-1 text-ok" onClick={() => onDecide({ action: "accept" })}>
        Akceptuj
      </button>
      <label className="flex items-center gap-2 text-[12px]">
        <span className="label">Połącz z</span>
        <select
          aria-label={`Połącz ${id} z Wątkiem`}
          value={into}
          onChange={(e) => setInto(e.target.value)}
          className="border border-line bg-ink px-2 py-1"
        >
          <option value="">—</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" disabled={busy || !into} className="tag px-3 py-1" onClick={() => onDecide({ action: "merge", into })}>
        Połącz
      </button>
      <button type="button" disabled={busy} className="tag px-3 py-1 text-alert" onClick={() => onDecide({ action: "reject" })}>
        Odrzuć
      </button>
    </div>
  );
}

function ScenarioCard({ scenario, mostLikely }: { scenario: ReportScenario; mostLikely: boolean }) {
  return (
    <article className={`border p-3 ${mostLikely ? "border-alert" : "border-line"}`}>
      <p className="label">{SCENARIO_LABEL[scenario.kind]}{mostLikely ? " · najbardziej prawdopodobny" : ""}</p>
      <h3 className="font-display text-lg font-medium">{scenario.name}</h3>
      <p className="mt-1 text-[13px]">
        <strong className={CHANGE_TONE[scenario.change]}>{CHANGE_ARROW[scenario.change]}</strong> {scenario.likelihood}
      </p>
      <p className="text-[11px] text-dim">{scenario.reason}</p>
      <p className="mt-2 text-[13px] text-fg/90">{scenario.description}</p>
      {scenario.signals.length > 0 && (
        <ul className="mt-2 grid gap-1 border-t border-line pt-2" aria-label={`Sygnały: ${scenario.name}`}>
          {scenario.signals.map((s) => (
            <li key={s.text} className="text-[12px]">
              <span className={s.lit ? "text-alert" : "text-faint"}>{s.lit ? "● zapalony" : "○ czeka"}</span> {s.text}
              {s.evidence && (
                <>
                  {" — dowód: "}
                  <a href={s.evidence.url} target="_blank" rel="noopener noreferrer">
                    {s.evidence.title}
                  </a>
                  <span className="text-dim">{` (${s.evidence.source}, ${s.evidence.tier})`}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Report({ report }: { report: SituationReport }) {
  return (
    <div className="grid gap-6">
      <Panel title="Stan teraz" aside={<>Raport z {stamp(report.createdAt)} · z {report.basedOn} Zdarzeń</>}>
        <p className="max-w-3xl leading-relaxed">{report.state}</p>
        <p className="mt-2 text-[13px] text-dim">Co się zmieniło: {report.whatChanged}</p>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        {report.scenarios.map((s) => (
          <ScenarioCard key={s.kind} scenario={s} mostLikely={s.kind === report.mostLikely} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Aktorzy i interesy">
          <ul className="grid gap-1 text-[13px]">
            {report.actors.map((a) => (
              <li key={a.name}>
                <strong>{a.name}</strong> — <span className="text-dim">{a.interest}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Rynki i relacje">
          <ul className="grid gap-1 text-[13px]">
            {report.assets.map((a) => (
              <li key={a.name}>
                <strong>{a.name}</strong> {a.direction === "up" ? "↑" : a.direction === "down" ? "↓" : "↕"} <span className="text-dim">{a.why}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px]">{report.relations}</p>
        </Panel>
      </div>
    </div>
  );
}

export function ThreadPage({ id }: { id: string }) {
  const query = useQuery<ThreadResponse | null>({ queryKey: ["thread", id], queryFn: () => fetchThread(id) });
  if (query.isPending) return <p className="label">Otwieram akta Wątku<span className="blink">_</span></p>;
  if (query.isError) return <p className="label text-alert">Nie udało się pobrać Wątku.</p>;
  if (!query.data) return <p className="label text-alert">Nie ma takiego Wątku.</p>;
  const { thread, report, timeline } = query.data;
  return (
    <div className="grid gap-6">
      <div>
        <p className="label text-alert">Wątek{thread.dormant ? " · uśpiony" : ""}</p>
        <h1 className="font-display text-4xl font-bold tracking-[0.1em] uppercase">{thread.name}</h1>
        <p className="mt-1 text-dim">
          {thread.regions.map((r) => REGION_LABEL[r]).join(", ")} · {thread.eventCount} Zdarzeń · ostatnie {stamp(thread.lastEventAt)}
        </p>
      </div>
      {report ? <Report report={report} /> : <p className="label">Pierwszy Raport sytuacyjny powstanie w ciągu godziny.</p>}
      <Panel title="Oś czasu · od najnowszych">
        <ol className="grid gap-2">
          {timeline.map((e) => (
            <EntryLine key={e.eventId} entry={e} />
          ))}
        </ol>
      </Panel>
    </div>
  );
}
