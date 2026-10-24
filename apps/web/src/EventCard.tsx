import { type AnalyzedEvent, type Branch, COMPANY_NAME, type CompanyImpact } from "@foresight/shared";
import { Link } from "@tanstack/react-router";
import { ACTOR_LABEL, COMPANY_ARROW, DIRECTION_ARROW, isTopic, REGION_LABEL, TOPIC_LABEL, WEIGHT_LABEL } from "./labels.js";

const COMPANY_COLOR: Record<CompanyImpact["direction"], string> = { up: "text-ok", down: "text-alert", uncertain: "text-amber" };

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
                {isTopic(t) ? (
                  <Link to="/topic/$topic" params={{ topic: t }} className="tag tag-topic">
                    {TOPIC_LABEL[t]}
                  </Link>
                ) : (
                  <span className="tag tag-topic">{TOPIC_LABEL[t]}</span>
                )}
              </li>
            ))}
          </ul>
          {"actors" in analysis && analysis.actors.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-dim" aria-label="Aktorzy">
              {analysis.actors.map((a) => (
                <li key={a}>{ACTOR_LABEL[a]}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 max-w-3xl leading-relaxed text-fg/90">{analysis.whyItMatters}</p>
          {"companies" in analysis && analysis.companies.length > 0 && (
            <ul className="mt-3 grid gap-1 border-t border-line pt-3" aria-label="Spółki">
              {analysis.companies.map((c) => (
                <li key={c.company} className="text-[12px] leading-relaxed">
                  <strong className="label text-fg">
                    {`${COMPANY_NAME[c.company]} (${c.company}) `}
                    <span className={COMPANY_COLOR[c.direction]}>{COMPANY_ARROW[c.direction]}</span>
                  </strong>{" "}
                  <span className="text-dim">{c.mechanism}</span>
                </li>
              ))}
            </ul>
          )}
          {/* Analizy sprzed plastra 10 miały Scenariusz przy każdym Zdarzeniu; nowe mają go w Raporcie Wątku. */}
          {"scenario" in analysis && (
            <ul className="mt-3 grid gap-2 border-t border-line pt-3 md:grid-cols-2">
              <BranchItem name="Eskalacja" branch={analysis.scenario.escalation} />
              <BranchItem name="Deeskalacja" branch={analysis.scenario.deescalation} />
            </ul>
          )}
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
