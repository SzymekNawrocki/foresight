import type { LikelihoodChange, ReportScenario, SituationReport, ThreadResponse, ThreadsResponse, TimelineEntry } from "@foresight/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { decideProposal, fetchProposals, fetchThread, fetchThreads } from "./api.js";
import { CHANGE_ARROW, REGION_LABEL, SCENARIO_LABEL, TIER_LABEL, WEIGHT_LABEL } from "./labels.js";
import { LoadError, PageHeader, Panel } from "./panel.js";
import { useSession } from "./session.js";
import { When } from "./time.js";
import { Button } from "./ui/button.js";
import { Loading } from "./ui/skeleton.js";

// A change of Likelihood is neither good nor bad: brass means "changed, look here" (ADR 0011).
const CHANGE_TONE: Record<LikelihoodChange, string> = { up: "text-brass", down: "text-brass", same: "text-dim", new: "text-brass" };

export function useThreads() {
  return useQuery({ queryKey: ["threads"], queryFn: fetchThreads, refetchInterval: 5 * 60_000 });
}

/** New situations; only the owner may read them, so the query waits for a session. */
export function useProposals(enabled: boolean) {
  return useQuery({ queryKey: ["proposals"], queryFn: fetchProposals, enabled });
}

type ListedThread = ThreadsResponse["threads"][number];

function ThreadRow({ thread }: { thread: ListedThread }) {
  return (
    <li className="border-b border-line py-2.5 last:border-b-0">
      <Link to="/thread/$id" params={{ id: thread.id }} className="text-[17px] font-medium">
        {thread.name}
      </Link>
      <p className="text-[14px] text-dim">
        {thread.lead ? (
          <>
            <span className={CHANGE_TONE[thread.lead.change]}>{CHANGE_ARROW[thread.lead.change]}</span>{" "}
            {`Najbardziej prawdopodobne: ${thread.lead.scenario} — ${thread.lead.likelihood}`}
          </>
        ) : (
          "Raport sytuacyjny w przygotowaniu"
        )}
        {" · "}
        <span className="data">{thread.eventCount}</span>
        {" Zdarzeń, ostatnie "}
        <When iso={thread.lastEventAt} />
        {thread.moves?.length ? ` · Ruchy: ${thread.moves.length}` : ""}
      </p>
    </li>
  );
}

export function ThreadList({ threads }: { threads: ListedThread[] }) {
  return (
    <ul>
      {threads.map((t) => (
        <ThreadRow key={t.id} thread={t} />
      ))}
    </ul>
  );
}

export function ThreadsPanel() {
  const threads = useThreads();
  const active = threads.data?.threads.filter((t) => !t.dormant) ?? [];
  return (
    <Panel title="Wątki aktywne" aside="Zdarzenie w ostatnich 14 dniach">
      {threads.isPending ? (
        <Loading label="Ładuję Wątki" rows={2} />
      ) : threads.isError ? (
        <LoadError what="Wątków" retry={threads.refetch} />
      ) : active.length === 0 ? (
        <p className="text-dim">Brak aktywnych Wątków — propozycje czekają w Skrzynce.</p>
      ) : (
        <ThreadList threads={active} />
      )}
    </Panel>
  );
}

/** /threads — every Thread; the card grid comes with the Threads PR of #71. */
export function ThreadsPage() {
  const threads = useThreads();
  const dormant = threads.data?.threads.filter((t) => t.dormant) ?? [];
  return (
    <div className="grid gap-6">
      <PageHeader title="Wątki" subtitle="Sytuacje, które Foresight śledzi w czasie, z Raportem sytuacyjnym raz na dobę." />
      <ThreadsPanel />
      {dormant.length > 0 && (
        <Panel title="Uśpione" aside="Bez Zdarzenia od 14 dni">
          <ThreadList threads={dormant} />
        </Panel>
      )}
    </div>
  );
}

function EntryLine({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="border-l-2 border-line py-1 pl-3">
      <span className="data text-dim">
        <When iso={entry.publishedAt} /> · {entry.source} · Poziom {TIER_LABEL[entry.tier]} · Waga {entry.weight} ({WEIGHT_LABEL[entry.weight]})
      </span>
      <br />
      <a href={entry.url} target="_blank" rel="noopener noreferrer">
        {entry.title}
      </a>
      <p className="text-[14px] text-dim">{entry.whyItMatters}</p>
    </li>
  );
}

/** /inbox — New situations; visible only to the owner, the API checks the token on every call anyway. */
export function InboxPage() {
  const token = useSession();
  return (
    <div className="grid gap-6">
      <PageHeader title="Skrzynka" subtitle="Nowe sytuacje zaproponowane przez AI: zacznij śledzić, połącz z Wątkiem albo odrzuć." />
      {token ? <Inbox /> : <p className="text-dim">Skrzynka jest dostępna po zalogowaniu.</p>}
    </div>
  );
}

function Inbox() {
  const client = useQueryClient();
  const proposals = useProposals(true);
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

  if (proposals.isPending) return <Loading label="Ładuję Skrzynkę" />;
  if (proposals.isError) return <LoadError what="Skrzynki" retry={proposals.refetch} />;
  return (
    <>
      {list.length === 0 ? (
        <p className="text-dim">Skrzynka pusta. Nowe sytuacje pojawiają się po godzinnych przebiegach workera.</p>
      ) : (
        <ul className="grid gap-4">
          {list.map(({ thread, timeline }) => (
            <li key={thread.id} className="rounded-lg border border-line bg-surface p-4">
              <h3 className="text-[17px] font-medium">{thread.name}</h3>
              <p className="text-[14px] text-dim">
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
      {error && (
        <p role="alert" className="text-coral">
          {error}
        </p>
      )}
    </>
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
      <Button variant="primary" size="sm" disabled={busy} onClick={() => onDecide({ action: "accept" })}>
        Akceptuj
      </Button>
      <label className="flex items-center gap-2 text-[14px]">
        <span className="text-dim">Połącz z</span>
        <select
          aria-label={`Połącz ${id} z Wątkiem`}
          value={into}
          onChange={(e) => setInto(e.target.value)}
          className="h-8 rounded-md border border-line bg-bg px-2"
        >
          <option value="">—</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <Button size="sm" disabled={busy || !into} onClick={() => onDecide({ action: "merge", into })}>
        Połącz
      </Button>
      <Button size="sm" disabled={busy} onClick={() => onDecide({ action: "reject" })}>
        Odrzuć
      </Button>
    </div>
  );
}

function ScenarioCard({ scenario, mostLikely }: { scenario: ReportScenario; mostLikely: boolean }) {
  return (
    <article className={`rounded-lg border bg-surface p-4 ${mostLikely ? "border-brass/60" : "border-line"}`}>
      <p className="label">
        {SCENARIO_LABEL[scenario.kind]}
        {mostLikely ? " · najbardziej prawdopodobny" : ""}
      </p>
      <h3 className="text-[17px] font-medium">{scenario.name}</h3>
      <p className="mt-1">
        <strong className={CHANGE_TONE[scenario.change]}>{CHANGE_ARROW[scenario.change]}</strong> {scenario.likelihood}
      </p>
      <p className="text-[13px] text-dim">{scenario.reason}</p>
      <p className="mt-2 text-[14px]">{scenario.description}</p>
      {scenario.signals.length > 0 && (
        <ul className="mt-2 grid gap-1 border-t border-line pt-2" aria-label={`Sygnały: ${scenario.name}`}>
          {scenario.signals.map((s) => (
            <li key={s.text} className="text-[14px]">
              <span className={s.lit ? "text-brass" : "text-faint"}>{s.lit ? "● zapalony" : "○ czeka"}</span> {s.text}
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
      <Panel
        title="Stan teraz"
        aside={
          <>
            Raport <When iso={report.createdAt} /> · z {report.basedOn} Zdarzeń
          </>
        }
      >
        <p className="max-w-3xl">{report.state}</p>
        <p className="mt-2 text-[14px] text-dim">Co się zmieniło: {report.whatChanged}</p>
      </Panel>
      <div className="grid gap-3 md:grid-cols-3">
        {report.scenarios.map((s) => (
          <ScenarioCard key={s.kind} scenario={s} mostLikely={s.kind === report.mostLikely} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Aktorzy i interesy">
          <ul className="grid gap-1 text-[14px]">
            {report.actors.map((a) => (
              <li key={a.name}>
                <strong className="font-medium">{a.name}</strong> — <span className="text-dim">{a.interest}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Rynki i relacje">
          <ul className="grid gap-1 text-[14px]">
            {report.assets.map((a) => (
              <li key={a.name}>
                <strong className="font-medium">{a.name}</strong> {a.direction === "up" ? "↑" : a.direction === "down" ? "↓" : "↕"}{" "}
                <span className="text-dim">{a.why}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[14px]">{report.relations}</p>
        </Panel>
      </div>
    </div>
  );
}

export function ThreadPage({ id }: { id: string }) {
  const query = useQuery<ThreadResponse | null>({ queryKey: ["thread", id], queryFn: () => fetchThread(id) });
  if (query.isPending) return <Loading label="Otwieram Wątek" />;
  if (query.isError) return <LoadError what="Wątku" retry={query.refetch} />;
  if (!query.data) return <p className="text-coral">Nie ma takiego Wątku.</p>;
  const { thread, report, timeline } = query.data;
  return (
    <div className="grid gap-6">
      <div>
        <p className="label">Wątek{thread.dormant ? " · uśpiony" : ""}</p>
        <h1 className="text-[28px] leading-tight font-semibold">{thread.name}</h1>
        <p className="mt-1 text-dim">
          {thread.regions.map((r) => REGION_LABEL[r]).join(", ")} · {thread.eventCount} Zdarzeń · ostatnie <When iso={thread.lastEventAt} />
        </p>
      </div>
      {report ? <Report report={report} /> : <p className="text-dim">Pierwszy Raport sytuacyjny powstanie w ciągu godziny.</p>}
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
