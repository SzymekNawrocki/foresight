import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "./cn.js";

// shadcn/ui on Base UI, styled with our tokens (ADR 0011).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-[14px] font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brass text-bg hover:bg-brass/90",
        outline: "border border-line bg-surface text-fg hover:border-brass hover:text-brass",
        ghost: "text-dim hover:bg-raised hover:text-fg",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({ className, variant, size, ...props }: ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
  return <ButtonPrimitive className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
