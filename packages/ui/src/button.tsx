import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "./utils.js";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius)] px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-95",
        secondary: "bg-[var(--muted)] text-[var(--foreground)] hover:brightness-95",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, type = "button", variant, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
