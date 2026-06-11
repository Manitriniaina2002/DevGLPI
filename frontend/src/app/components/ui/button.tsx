'use client'

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border text-sm font-semibold shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ades-green/30 focus-visible:ring-offset-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border-ades-green/20 bg-white text-ades-green hover:border-slate-300 hover:bg-slate-50 hover:text-ades-green hover:shadow-sm",
        destructive:
          "border-red-200 bg-white text-red-600 hover:border-slate-300 hover:bg-slate-50 hover:text-red-700 hover:shadow-sm focus-visible:ring-red-500/20 dark:bg-destructive/60",
        outline:
          "border-ades-green/25 bg-white text-ades-green hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "border-ades-yellow/50 bg-white text-neutral-800 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm",
        ghost:
          "border-transparent bg-transparent shadow-none text-neutral-700 hover:bg-slate-100 hover:text-neutral-900 dark:hover:bg-accent/50",
        link: "border-transparent bg-transparent px-0 text-ades-green shadow-none hover:bg-transparent hover:text-ades-green",
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 px-6 text-base has-[>svg]:px-5",
        icon: "size-9 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
