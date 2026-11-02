import type { ComponentProps } from "react";
import { cn } from "./cn.js";

/** A console panel: chamfered frame; `brackets` marks the two corners the chamfer leaves. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("frame brackets", className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-3 py-2", className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-3", className)} {...props} />;
}
