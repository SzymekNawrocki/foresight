import type { Analysis as AnalysisData, Branch } from "@foresight/shared";
import { DIRECTION_ARROW, REGION_LABEL, TOPIC_LABEL, WEIGHT_LABEL } from "./labels.js";

// Tekst od LLM jest niezaufany tak samo jak RSS: React wstawia go wyłącznie jako tekst.
export function Analysis({ analysis }: { analysis: AnalysisData }) {
  return (
    <div>
      <p>
        <strong>
          Waga {analysis.weight} · {WEIGHT_LABEL[analysis.weight]}
        </strong>
      </p>
      <dl>
        <dt>Regiony</dt>
        <dd>{analysis.regions.map((r) => REGION_LABEL[r]).join(", ")}</dd>
        <dt>Tematy</dt>
        <dd>{analysis.topics.length ? analysis.topics.map((t) => TOPIC_LABEL[t]).join(", ") : "—"}</dd>
      </dl>
      <p>{analysis.whyItMatters}</p>
      <ul>
        <BranchItem name="Eskalacja" branch={analysis.scenario.escalation} />
        <BranchItem name="Deeskalacja" branch={analysis.scenario.deescalation} />
      </ul>
    </div>
  );
}

function BranchItem({ name, branch }: { name: string; branch: Branch }) {
  return (
    <li>
      <strong>{`${name}: ${branch.assetClass} ${DIRECTION_ARROW[branch.direction]}`}</strong> <span>{branch.path}</span>
    </li>
  );
}
