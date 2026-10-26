import { type AnalyzedEvent, Topic } from "@foresight/shared";
import { Link } from "@tanstack/react-router";
import { EventCard } from "./EventCard.js";
import { freshness, movedThreads, radar, type ThreadMove, threadMoves } from "./intel.js";
import { CHANGE_ARROW, TOPIC_LABEL } from "./labels.js";
import { useRecent } from "./pages.js";
import { LoadError, PageHeader, Panel } from "./panel.js";
import { useSession } from "./session.js";
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
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 no-underline hover:border-brass hover:no-underline"
        >
          <span>{TOPIC_LABEL[t]}</span> <span className={`data font-semibold ${counts[t] ? "text-brass" : "text-faint"}`}>{counts[t]}</span>
        </Link>
      ))}
    </nav>
  );
}

function EmptyDay({ events }: { events: readonly AnalyzedEvent[] }) {
  const fresh = freshness(events, new Date());
  return (
    <p className="text-dim">
      {"W ostatnich 24 h nie ma Zdarzeń z Niszy. Worker analizuje nowe Zdarzenia co godzinę"}
      {fresh ? `; ${fresh.text}.` : "."}
    </p>
  );
}

function MovedThread({ thread }: { thread: ListedThread }) {
  return (
    <li className="border-b border-line py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/thread/$id" params={{ id: thread.id }} className="font-medium">
          {thread.name}
        </Link>
        {thread.newEvents > 0 && <Badge tone="brass">{`+${thread.newEvents} nowe`}</Badge>}
      </div>
      <p className="text-[14px] text-dim">
        {thread.lead ? (
          <>
            <span className="text-brass">{CHANGE_ARROW[thread.lead.change]}</span>
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
    <li className="border-b border-line py-2 text-[14px] last:border-b-0">
      <span className="text-dim">
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
    <Link to="/inbox" className="flex items-center justify-between gap-3 rounded-lg border border-brass/40 bg-brass/5 px-4 py-3 no-underline">
      <span>{`Nowe sytuacje czekają na decyzję: ${count}`}</span>
      <span className="text-brass" aria-hidden>
        →
      </span>
    </Link>
  );
}

function ThreadsColumn() {
  const threads = useThreads();
  if (threads.isPending) return <Loading label="Ładuję Wątki" rows={2} />;
  if (threads.isError) return <LoadError what="Wątków" retry={threads.refetch} />;
  const now = new Date();
  const moved = movedThreads(threads.data.threads, now);
  const moves = threadMoves(threads.data.threads, now);
  return (
    <>
      <Panel title="Wątki w ruchu" aside="Nowe Zdarzenia od Raportu">
        {moved.length === 0 ? (
          <p className="text-dim">Żaden Wątek nie dostał dziś nowych Zdarzeń.</p>
        ) : (
          <ul>
            {moved.map((t) => (
              <MovedThread key={t.id} thread={t} />
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Ruchy · 24 h" aside="Prawdopodobieństwo i sygnały">
        {moves.length === 0 ? (
          <p className="text-dim">Bez zmian w Raportach z ostatnich 24 h.</p>
        ) : (
          <ul>
            {moves.map((m, i) => (
              <MoveLine key={`${m.thread.id}-${i}`} item={m} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

// Radar (CONTEXT.md, ADR 0011): what matters in the Niche today and what is worth a post.
// Two columns on desktop, one on mobile in the same order; no map — that lives on the Stream.
export function RadarPage() {
  const recent = useRecent();
  const today = recent.data ? radar(recent.data.events, new Date()) : null;
  return (
    <div className="grid gap-6">
      <PageHeader title="Radar" subtitle="Co dziś ważne w Niszy i co nadaje się na post." />
      {today && <TopicBar counts={today.topics} />}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title="Najważniejsze dziś" aside="Waga, potem czas · 24 h">
          {recent.isPending ? (
            <Loading label="Ładuję Zdarzenia" />
          ) : recent.isError ? (
            <LoadError what="Zdarzeń" retry={recent.refetch} />
          ) : today?.top.length ? (
            <ol className="grid gap-3">
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
        <div className="grid gap-6">
          <InboxShortcut />
          <ThreadsColumn />
        </div>
      </div>
    </div>
  );
}
