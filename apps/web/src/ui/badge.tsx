import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn.js";

// The tone follows the colour semantics of ADR 0011; a word or icon always goes with it.
const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2 py-px text-[12px] font-medium whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-line bg-raised text-dim",
      brass: "border-brass/50 bg-brass/10 text-brass",
      coral: "border-coral/50 bg-coral/10 text-coral",
      copper: "border-copper/50 bg-copper/10 text-copper",
      sage: "border-sage/50 bg-sage/10 text-sage",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
