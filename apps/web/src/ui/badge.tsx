import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn.js";

// The tone follows the colour semantics of ADR 0013; a word or icon always goes with it.
const badgeVariants = cva("inline-flex items-center gap-1 border px-1.5 font-display text-xs leading-5 font-semibold tracking-[0.06em] whitespace-nowrap uppercase", {
  variants: {
    tone: {
      neutral: "border-border bg-raised text-muted",
      accent: "border-amber bg-amber-wash text-amber",
      critical: "border-critical bg-critical-wash text-critical",
      positive: "border-positive bg-positive-wash text-positive",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
