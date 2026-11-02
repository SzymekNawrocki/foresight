import { LIKELIHOOD, type Likelihood } from "@foresight/shared";
import { cn } from "./cn.js";

/**
 * The 7 steps of ICD 203 as a thin segmented gauge (ADR 0013). Decorative: the word of
 * the Likelihood is always written next to it, so screen readers skip the gauge.
 */
export function LikelihoodGauge({ value, className }: { value: Likelihood; className?: string }) {
  const rank = LIKELIHOOD.indexOf(value);
  return (
    <span aria-hidden data-rank={rank + 1} className={cn("inline-grid h-1.5 w-28 grid-cols-7 gap-0.5", className)}>
      {LIKELIHOOD.map((step, i) => (
        <span key={step} className={i <= rank ? "bg-amber" : "bg-border"} />
      ))}
    </span>
  );
}
