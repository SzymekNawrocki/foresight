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
        "frame frame-sm inline-flex h-11 items-center md:h-8 gap-1.5 px-3 text-base text-muted transition-colors hover:frame-strong hover:text-fg data-[pressed]:frame-accent data-[pressed]:frame-wash data-[pressed]:text-amber",
        className,
      )}
      {...props}
    />
  );
}
