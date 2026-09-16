import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const INPUT_BASE_CLASS =
  "w-full bg-white/4 border border-white/12 rounded-md px-3 py-2 " +
  "text-sm text-white placeholder:text-white/40 " +
  "focus:outline-none focus:border-indigo-500 focus:bg-indigo-500/6 " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "transition-colors duration-[var(--duration-fast)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = "text", ...rest },
  ref,
) {
  return <input ref={ref} type={type} className={cn(INPUT_BASE_CLASS, className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(INPUT_BASE_CLASS, "min-h-24", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(INPUT_BASE_CLASS, "appearance-none bg-ink pr-8 [color-scheme:dark]", className)}
      {...rest}
    />
  );
});
