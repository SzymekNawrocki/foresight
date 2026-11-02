import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn.js";

// shadcn/ui on Base UI, styled with the console tokens (ADR 0013). Primary and outline are
// chamfered frames; ghost has no frame. Focus thickens the frame (clip-path cuts outlines).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 text-base font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "frame frame-sm frame-accent frame-wash text-amber hover:text-amber-strong hover:[--frame:var(--color-amber-strong)]",
        outline: "frame frame-sm frame-raised text-fg hover:frame-strong hover:frame-hover",
        ghost: "text-muted hover:bg-hover hover:text-fg",
      },
      size: {
        sm: "h-11 px-3 md:h-8",
        md: "h-11 px-4 md:h-9",
        icon: "size-11 md:size-9",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({ className, variant, size, ...props }: ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
