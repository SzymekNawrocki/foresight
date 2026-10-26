import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import type { ComponentProps } from "react";
import { cn } from "./cn.js";

// shadcn/ui ToggleGroup on Base UI: arrow keys move between items, aria-pressed carries the state.
export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive<string>>) {
  return <ToggleGroupPrimitive className={cn("flex flex-wrap gap-1.5", className)} {...props} />;
}

export function Toggle({ className, ...props }: ComponentProps<typeof TogglePrimitive<string>>) {
  return (
    <TogglePrimitive
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[14px] text-dim transition-colors hover:border-faint hover:text-fg data-[pressed]:border-brass/60 data-[pressed]:bg-brass/10 data-[pressed]:text-brass",
        className,
      )}
      {...props}
    />
  );
}
