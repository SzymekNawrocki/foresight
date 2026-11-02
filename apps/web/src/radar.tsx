import { type AnalyzedEvent, Topic } from "@foresight/shared";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { EventCard } from "./EventCard.js";
import { freshness, movedThreads, radar, theatre, threadCodes, type ThreadMove, threadMoves } from "./intel.js";
import { CHANGE_ARROW, TOPIC_LABEL } from "./labels.js";
import { useRecent } from "./pages.js";
import { LoadError, PageHeader, Panel } from "./panel.js";
import { useSession } from "./session.js";
import { TheatreMap } from "./TheatreMap.js";
import { useProposals, useThreads } from "./threads.js";
import { When } from "./time.js";
import { Badge } from "./ui/badge.js";
import { Loading } from "./ui/skeleton.js";

type ListedThread = ReturnType<typeof movedThreads>[number];

function TopicBar({ counts }: { counts: Record<Topic, number> }) {
  return (
    <nav aria-label="Tematy · 24 h" className="flex flex-wrap gap-2">
      {Topic.options.map((t) => (
        <Link
          key={t}
          to="/stream"
          search={{ topic: t }}
          className="flex items-center gap-2 frame px-3 py-2 no-underline hover:frame-accent hover:no-underline"
        >
          <span>{TOPIC_LABEL[t]}</span> <span className={`data font-semibold ${counts[t] ? "text-amber" : "text-faint"}`}>{counts[t]}</span>
        </Link>
      ))}
    </nav>
  );
}

function EmptyDay({ events }: { events: readonly AnalyzedEvent[] }) {
  const fresh = freshness(events, new Date());
  return (
    <p className="text-muted">
      {"W ostatnich 24 h nie ma Zdarzeń z Niszy. Worker analizuje nowe Zdarzenia co godzinę"}
      {fresh ? `; ${fresh.text}.` : "."}
    </p>
  );
}

type Lighting = { lit: string | null; onLight: (id: string | null) => void };

function MovedThread({ thread, code, lit, onLight }: { thread: ListedThread; code?: string | undefined } & Lighting) {
  const on = lit === thread.id;
  return (
    <li
      className={`-mx-3 border-b border-l-2 border-b-border px-3 py-2.5 transition-colors last:border-b-0 ${on ? "border-l-amber bg-amber-wash" : "border-l-transparent"}`}
      onMouseEnter={() => onLight(thread.id)}
      onMouseLeave={() => onLight(null)}
      onFocus={() => onLight(thread.id)}
      onBlur={() => onLight(null)}
    >
      <div className="flex flex-wrap items-center gap-2">
        {code && <span className={`data text-xs font-semibold ${on ? "text-amber" : "text-faint"}`}>{code}</span>}
        <Link to="/thread/$id" params={{ id: thread.id }} className="font-medium">
          {thread.name}
        </Link>
        {thread.newEvents > 0 && <Badge tone="accent">{`+${thread.newEvents} nowe`}</Badge>}
      </div>
      <p className="text-base text-muted">
        {thread.lead ? (
          <>
            <span className="text-amber">{CHANGE_ARROW[thread.lead.change]}</span>
            {` ${thread.lead.scenario} — ${thread.lead.likelihood} · `}
          </>
        ) : (
          "Raport w przygotowaniu · "
        )}
        {"ostatnie Zdarzenie "}
        <When iso={thread.lastEventAt} />
      </p>
    </li>
  );
}

function MoveLine({ item }: { item: ThreadMove }) {
  const { move } = item;
  return (
    <li className="border-b border-border py-2 text-base last:border-b-0">
      <span className="text-muted">
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
          <strong className="font-medium text-amber">{move.to}</strong>
        </>
      ) : (
        <>
          <span className="text-amber" aria-hidden>
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
    <Link to="/inbox" className="flex items-center justify-between gap-3 frame frame-accent frame-wash px-4 py-3 no-underline">
      <span>{`Nowe sytuacje czekają na decyzję: ${count}`}</span>
      <span className="text-amber" aria-hidden>
        →
      </span>
    </Link>
  );
}

function MovedPanel({ threads, codes, ...lighting }: { threads: ListedThread[]; codes: Map<string, string> } & Lighting) {
  return (
    <Panel title="Wątki w ruchu" aside="Nowe Zdarzenia od Raportu">
      {threads.length === 0 ? (
        <p className="text-muted">Żaden Wątek nie dostał dziś nowych Zdarzeń.</p>
      ) : (
        <ul>
          {threads.map((t) => (
            <MovedThread key={t.id} thread={t} code={codes.get(t.id)} {...lighting} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MovesPanel({ moves }: { moves: ThreadMove[] }) {
  return (
    <Panel title="Ruchy · 24 h" aside="Prawdopodobieństwo i sygnały">
      {moves.length === 0 ? (
        <p className="text-muted">Bez zmian w Raportach z ostatnich 24 h.</p>
      ) : (
        <ul>
          {moves.map((m, i) => (
            <MoveLine key={`${m.thread.id}-${i}`} item={m} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

// Radar (CONTEXT.md, ADR 0013): what matters in the Niche today and what is worth a post.
// The map is the theatre in the centre; Threads in motion on the left, Moves and the Inbox on
// the right. Below xl the map comes first, then the two side columns, then the Events.
export function RadarPage() {
  const recent = useRecent();
  const threads = useThreads();
  const [lit, setLit] = useState<string | null>(null);
  const now = new Date();
  const today = recent.data ? radar(recent.data.events, now) : null;
  const list = threads.data?.threads ?? [];
  const codes = threadCodes(list);
  // The newest fetch time, shown on the map as "STAN 13:15Z".
  const updatedAt = recent.data?.events.reduce<string | undefined>((max, e) => (!max || e.fetchedAt > max ? e.fetchedAt : max), undefined);

  const threadPanels =
    threads.isPending ? (
      <Loading label="Ładuję Wątki" rows={2} />
    ) : threads.isError ? (
      <LoadError what="Wątków" retry={threads.refetch} />
    ) : null;

  return (
    <div className="grid gap-4">
      <PageHeader title="Radar" subtitle="Co dziś ważne w Niszy i co nadaje się na post." />
      {today && <TopicBar counts={today.topics} />}
      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <div className="grid gap-4 lg:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
          {recent.data && threads.data && (
            <TheatreMap theatre={theatre(recent.data.events, list, now)} lit={lit} onLight={setLit} updatedAt={updatedAt} />
          )}
          <Panel title="Najważniejsze dziś" aside="Waga, potem czas · 24 h">
            {recent.isPending ? (
              <Loading label="Ładuję Zdarzenia" />
            ) : recent.isError ? (
              <LoadError what="Zdarzeń" retry={recent.refetch} />
            ) : today?.top.length ? (
              <ol className="grid gap-2">
                {today.top.map((e) => (
                  <li key={e.id}>
                    <EventCard event={e} />
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyDay events={recent.data.events} />
            )}
          </Panel>
        </div>
        <div className="grid gap-4 xl:col-start-1 xl:row-start-1">
          {threadPanels ?? <MovedPanel threads={movedThreads(list, now)} codes={codes} lit={lit} onLight={setLit} />}
        </div>
        <div className="grid gap-4 xl:col-start-3 xl:row-start-1">
          <InboxShortcut />
          {threadPanels ?? <MovesPanel moves={threadMoves(list, now)} />}
        </div>
      </div>
    </div>
  );
}
