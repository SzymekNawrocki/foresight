import type { AnalyzedEvent, Branch } from "@foresight/shared";
import { Link } from "@tanstack/react-router";
import { DIRECTION_ARROW, REGION_LABEL, TOPIC_LABEL, WEIGHT_LABEL } from "./labels.js";

// Czas zawsze po polsku, niezależnie od strefy przeglądarki — Zdarzenia porównujemy między sobą.
const time = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Warsaw",
});

const STAMP: Record<number, string> = {
  3: "bg-alert text-ink border-alert",
  2: "text-amber border-amber",
  1: "text-faint border-line",
};

// Treść z RSS i od LLM jest niezaufana: React wstawia ją wyłącznie jako tekst,
// a link przeszedł walidację https w schemacie.
export function EventCard({ event }: { event: AnalyzedEvent }) {
  const { analysis } = event;
  return (
    <article className="border-l-2 border-line bg-panel/80 p-4 hover:border-alert">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="label text-faint">Akta {event.id.slice(0, 6).toUpperCase()}</span>
        {analysis ? (
          <span className={`border px-1.5 py-px font-display text-[11px] font-bold tracking-[0.2em] uppercase ${STAMP[analysis.weight]}`}>
            {`Waga ${analysis.weight} · ${WEIGHT_LABEL[analysis.weight]}`}
          </span>
        ) : (
          <span className="label text-amber">
            Analiza w kolejce<span className="blink">_</span>
          </span>
        )}
        <span className="ml-auto text-[11px] text-dim">
          <span>{event.source}</span> · <time dateTime={event.publishedAt}>{time.format(new Date(event.publishedAt))}</time>
        </span>
      </header>

      <h3 className="mt-2 font-display text-lg leading-snug font-medium">
        <a href={event.url} target="_blank" rel="noopener noreferrer">
          {event.title}
        </a>
      </h3>

      {analysis && (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Regiony i Tematy">
            {analysis.regions.map((r) => (
              <li key={r}>
                <Link to="/region/$region" params={{ region: r }} className="tag">
                  {REGION_LABEL[r]}
                </Link>
              </li>
            ))}
            {analysis.topics.map((t) => (
              <li key={t}>
                <Link to="/topic/$topic" params={{ topic: t }} className="tag tag-topic">
                  {TOPIC_LABEL[t]}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl leading-relaxed text-fg/90">{analysis.whyItMatters}</p>
          <ul className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-2">
            <BranchItem name="Eskalacja" branch={analysis.scenario.escalation} />
            <BranchItem name="Deeskalacja" branch={analysis.scenario.deescalation} />
          </ul>
        </>
      )}
    </article>
  );
}

function BranchItem({ name, branch }: { name: string; branch: Branch }) {
  const color = branch.direction === "up" ? "text-ok" : "text-alert";
  return (
    <li className="text-[12px] leading-relaxed">
      <strong className="label block text-fg">
        {`${name}: ${branch.assetClass} `}
        <span className={color}>{DIRECTION_ARROW[branch.direction]}</span>
      </strong>
      <span className="text-dim">{branch.path}</span>
    </li>
  );
}
