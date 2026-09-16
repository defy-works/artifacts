import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium tracking-wide whitespace-nowrap " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-indigo-500 transition-colors duration-[var(--duration-fast)] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-indigo-500 text-white hover:bg-indigo-400 active:bg-indigo-600",
  secondary: "border border-indigo-500/70 text-indigo-300 hover:bg-indigo-500/15",
  ghost: "text-white/75 hover:text-white hover:bg-white/6",
  danger: "bg-danger text-white hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-[11px]",
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    />
  );
});
