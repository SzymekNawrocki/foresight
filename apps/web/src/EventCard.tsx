import { type AnalyzedEvent, type Branch, COMPANY_NAME, type CompanyImpact, type Weight } from "@foresight/shared";
import { Link } from "@tanstack/react-router";
import { ACTOR_LABEL, COMPANY_ARROW, DIRECTION_ARROW, isTopic, REGION_LABEL, TOPIC_LABEL, WEIGHT_LABEL } from "./labels.js";
import { When } from "./time.js";
import { Badge } from "./ui/badge.js";

const COMPANY_COLOR: Record<CompanyImpact["direction"], string> = { up: "text-sage", down: "text-coral", uncertain: "text-dim" };

const WEIGHT_TONE: Record<Weight, "coral" | "copper" | "neutral"> = { 3: "coral", 2: "copper", 1: "neutral" };

// Treść z RSS i od LLM jest niezaufana: React wstawia ją wyłącznie jako tekst,
// a link przeszedł walidację https w schemacie.
export function EventCard({ event }: { event: AnalyzedEvent }) {
  const { analysis } = event;
  return (
    <article className="rounded-lg border border-line bg-surface p-4 hover:border-faint">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {analysis ? (
          <Badge tone={WEIGHT_TONE[analysis.weight]}>{`Waga ${analysis.weight} · ${WEIGHT_LABEL[analysis.weight]}`}</Badge>
        ) : (
          <Badge>Analiza w kolejce</Badge>
        )}
        <span className="data ml-auto text-dim">
          <span>{event.source}</span> · <When iso={event.publishedAt} />
        </span>
      </header>

      <h3 className="mt-2 text-[17px] leading-snug font-medium">
        <a href={event.url} target="_blank" rel="noopener noreferrer">
          {event.title}
        </a>
      </h3>

      {analysis && (
        <>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Regiony i Tematy">
            {analysis.regions.map((r) => (
              <li key={r}>
                <Link to="/stream" search={{ region: r }} className="tag">
                  {REGION_LABEL[r]}
                </Link>
              </li>
            ))}
            {analysis.topics.map((t) => (
              <li key={t}>
                {isTopic(t) ? (
                  <Link to="/stream" search={{ topic: t }} className="tag tag-topic">
                    {TOPIC_LABEL[t]}
                  </Link>
                ) : (
                  <span className="tag tag-topic">{TOPIC_LABEL[t]}</span>
                )}
              </li>
            ))}
          </ul>
          {"actors" in analysis && analysis.actors.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-dim" aria-label="Aktorzy">
              {analysis.actors.map((a) => (
                <li key={a}>{ACTOR_LABEL[a]}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 max-w-3xl">{analysis.whyItMatters}</p>
          {"companies" in analysis && analysis.companies.length > 0 && (
            <ul className="mt-3 grid gap-1 border-t border-line pt-3" aria-label="Spółki">
              {analysis.companies.map((c) => (
                <li key={c.company} className="text-[14px]">
                  <strong className="font-medium">
                    {`${COMPANY_NAME[c.company]} `}
                    <span className="data text-dim">({c.company})</span>{" "}
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
  return (
    <li className="text-[14px]">
      <strong className="block font-medium">
        {`${name}: ${branch.assetClass} `}
        <span className="text-dim">{DIRECTION_ARROW[branch.direction]}</span>
      </strong>
      <span className="text-dim">{branch.path}</span>
    </li>
  );
}
