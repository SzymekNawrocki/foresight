import type { ReportScenario, SituationReport, ThreadResponse, ThreadsResponse, TimelineEntry, Weight } from "@foresight/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchProposals, fetchThread, fetchThreads } from "./api.js";
import { threadGrid } from "./intel.js";
import { CHANGE_ARROW, CHANGE_LABEL, isTopic, REGION_LABEL, SCENARIO_LABEL, TIER_LABEL, TOPIC_LABEL, WEIGHT_LABEL } from "./labels.js";
import { LoadError, PageHeader, Panel, Section } from "./panel.js";
import { When } from "./time.js";
import { Badge } from "./ui/badge.js";
import { Loading } from "./ui/skeleton.js";

// A change of Likelihood is neither good nor bad: an arrow plus a word in brass, "changed, look here" (ADR 0011).
function Change({ change }: { change: ReportScenario["change"] }) {
  return <span className={change === "same" ? "text-dim" : "text-brass"}>{`${CHANGE_ARROW[change]} ${CHANGE_LABEL[change]}`}</span>;
}

export function useThreads() {
  return useQuery({ queryKey: ["threads"], queryFn: fetchThreads, refetchInterval: 5 * 60_000 });
}

/** New situations; only the owner may read them, so the query waits for a session. */
export function useProposals(enabled: boolean) {
  return useQuery({ queryKey: ["proposals"], queryFn: fetchProposals, enabled });
}

type ListedThread = ThreadsResponse["threads"][number];

function ThreadCard({ thread }: { thread: ListedThread }) {
  const topics = (thread.topics ?? []).filter(isTopic);
  return (
    <article className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="text-[17px] leading-snug font-medium">
          <Link to="/thread/$id" params={{ id: thread.id }}>
            {thread.name}
          </Link>
        </h3>
        {thread.newEvents > 0 && (
          <Badge tone="brass" className="ml-auto">
            {`+${thread.newEvents} nowe`}
          </Badge>
        )}
      </div>
      {thread.lead ? (
        <p className="text-[14px]">
          {`Najbardziej prawdopodobne: ${thread.lead.scenario} — ${thread.lead.likelihood}`} · <Change change={thread.lead.change} />
        </p>
      ) : (
        <p className="text-[14px] text-dim">Raport sytuacyjny w przygotowaniu</p>
      )}
      {topics.length > 0 && (
        <ul aria-label="Tematy" className="flex flex-wrap gap-1">
          {topics.map((t) => (
            <li key={t}>
              <Badge>{TOPIC_LABEL[t]}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-1 text-[13px] text-dim">
        {thread.regions.map((r) => REGION_LABEL[r]).join(", ") || "bez Regionu"}
        {" · "}
        <span className="data">{thread.eventCount}</span>
        {" Zdarzeń · ostatnie "}
        <When iso={thread.lastEventAt} />
      </p>
    </article>
  );
}

export function ThreadGrid({ threads, label }: { threads: ListedThread[]; label: string }) {
  return (
    <ul aria-label={label} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {threads.map((t) => (
        <li key={t.id}>
          <ThreadCard thread={t} />
        </li>
      ))}
    </ul>
  );
}

/** /threads — a card grid of the active Threads; dormant ones fold away at the bottom. */
export function ThreadsPage() {
  const threads = useThreads();
  return (
    <div className="grid gap-6">
      <PageHeader title="Wątki" subtitle="Sytuacje, które Foresight śledzi w czasie, z Raportem sytuacyjnym raz na dobę." />
      {threads.isPending ? (
        <Loading label="Ładuję Wątki" rows={3} />
      ) : threads.isError ? (
        <LoadError what="Wątków" retry={threads.refetch} />
      ) : (
        (() => {
          const { active, dormant } = threadGrid(threads.data.threads);
          return (
            <>
              <Section title="Aktywne" aside="Zdarzenie w ostatnich 14 dniach · nowe od Raportu najpierw">
                {active.length === 0 ? (
                  <p className="text-dim">Brak aktywnych Wątków — propozycje czekają w Skrzynce.</p>
                ) : (
                  <ThreadGrid threads={active} label="Wątki aktywne" />
                )}
              </Section>
              {dormant.length > 0 && (
                <details className="group">
                  <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md py-1 [&::-webkit-details-marker]:hidden">
                    <ChevronRight aria-hidden className="size-4 text-dim transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                    <span className="label text-fg">{`Uśpione · ${dormant.length}`}</span>
                    <span className="ml-2 text-[13px] text-dim">bez Zdarzenia od 14 dni</span>
                  </summary>
                  <div className="mt-3">
                    <ThreadGrid threads={dormant} label="Wątki uśpione" />
                  </div>
                </details>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}

// The dot on the timeline follows the colour semantics; the Weight is also written out next to it.
const WEIGHT_DOT: Record<Weight, string> = { 1: "bg-faint", 2: "bg-copper", 3: "bg-coral" };

export function Timeline({ entries, label }: { entries: TimelineEntry[]; label: string }) {
  return (
    <ol aria-label={label} className="ml-1 grid gap-4 border-l border-line pl-5">
      {entries.map((entry) => (
        <li key={entry.eventId} className="relative">
          <span aria-hidden className={`absolute top-1.5 -left-[26px] size-2.5 rounded-full ring-4 ring-surface ${WEIGHT_DOT[entry.weight]}`} />
          <span className="data text-[13px] text-dim">
            <When iso={entry.publishedAt} /> · {entry.source} · Poziom {TIER_LABEL[entry.tier]} · Waga {entry.weight} ({WEIGHT_LABEL[entry.weight]})
          </span>
          <br />
          <a href={entry.url} target="_blank" rel="noopener noreferrer">
            {entry.title}
          </a>
          <p className="text-[14px] text-dim">{entry.whyItMatters}</p>
        </li>
      ))}
    </ol>
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
        <strong className={scenario.change === "same" ? "text-dim" : "text-brass"}>{CHANGE_ARROW[scenario.change]}</strong>{" "}
        <span className={scenario.change === "same" ? "text-dim" : "text-brass"}>{CHANGE_LABEL[scenario.change]}</span> · {scenario.likelihood}
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

const REPORT_CONTENTS = [
  { anchor: "stan", title: "Stan teraz" },
  { anchor: "scenariusze", title: "Scenariusze" },
  { anchor: "aktorzy", title: "Aktorzy" },
  { anchor: "rynki", title: "Rynki" },
] as const;
const TIMELINE_CONTENTS = { anchor: "os-czasu", title: "Oś czasu" } as const;

function Report({ report }: { report: SituationReport }) {
  return (
    <>
      <Panel
        anchor="stan"
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
      <Section anchor="scenariusze" title="Scenariusze" aside="Trzy drogi i sygnały, które je zapalają">
        <div className="grid gap-3 md:grid-cols-3">
          {report.scenarios.map((s) => (
            <ScenarioCard key={s.kind} scenario={s} mostLikely={s.kind === report.mostLikely} />
          ))}
        </div>
      </Section>
      <div className="grid gap-6 md:grid-cols-2">
        <Panel anchor="aktorzy" title="Aktorzy i interesy">
          <ul className="grid gap-1 text-[14px]">
            {report.actors.map((a) => (
              <li key={a.name}>
                <strong className="font-medium">{a.name}</strong> — <span className="text-dim">{a.interest}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel anchor="rynki" title="Rynki i relacje">
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
    </>
  );
}

/** The section in view, for the table of contents; without IntersectionObserver (tests) nothing is marked. */
function useSectionInView(anchors: readonly string[]): string | undefined {
  const [current, setCurrent] = useState<string>();
  const key = anchors.join(" ");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -60% 0px" },
    );
    for (const anchor of key.split(" ")) {
      const el = document.getElementById(anchor);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return current;
}

/** Sticky contents: a column beside the page on desktop, a horizontal bar at the top on mobile. */
function Contents({ items }: { items: readonly { anchor: string; title: string }[] }) {
  const current = useSectionInView(items.map((i) => i.anchor));
  return (
    <nav
      aria-label="Spis treści"
      className="sticky top-0 z-10 -mx-4 overflow-x-auto border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:top-6 lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0"
    >
      <p className="label mb-2 hidden lg:block">Spis treści</p>
      <ol className="flex gap-1 lg:flex-col">
        {items.map(({ anchor, title }) => (
          <li key={anchor}>
            <a
              href={`#${anchor}`}
              aria-current={current === anchor ? "location" : undefined}
              className="block rounded-md px-2 py-1 whitespace-nowrap text-dim no-underline hover:text-fg hover:no-underline aria-[current=location]:bg-brass/10 aria-[current=location]:text-brass lg:border-l-2 lg:border-transparent lg:rounded-none lg:aria-[current=location]:border-brass"
            >
              {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ThreadPage({ id }: { id: string }) {
  const query = useQuery<ThreadResponse | null>({ queryKey: ["thread", id], queryFn: () => fetchThread(id) });
  if (query.isPending) return <Loading label="Otwieram Wątek" />;
  if (query.isError) return <LoadError what="Wątku" retry={query.refetch} />;
  if (!query.data) return <p className="text-coral">Nie ma takiego Wątku.</p>;
  const { thread, report, timeline } = query.data;
  const contents = report ? [...REPORT_CONTENTS, TIMELINE_CONTENTS] : [TIMELINE_CONTENTS];
  return (
    <div className="grid gap-6">
      <div>
        <p className="label">Wątek{thread.dormant ? " · uśpiony" : ""}</p>
        <h1 className="text-[28px] leading-tight font-semibold">{thread.name}</h1>
        <p className="mt-1 text-dim">
          {thread.regions.map((r) => REGION_LABEL[r]).join(", ")} · {thread.eventCount} Zdarzeń · ostatnie <When iso={thread.lastEventAt} />
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <Contents items={contents} />
        <div className="grid min-w-0 gap-6">
          {report ? <Report report={report} /> : <p className="text-dim">Pierwszy Raport sytuacyjny powstanie w ciągu godziny.</p>}
          <Panel anchor={TIMELINE_CONTENTS.anchor} title="Oś czasu" aside="od najnowszych">
            <Timeline entries={timeline} label="Oś czasu" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
