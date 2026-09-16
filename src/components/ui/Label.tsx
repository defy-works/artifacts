import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Editorial stamp label — mono, tracked, uppercase, indigo-tinted. */
export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label(
  { className, ...rest },
  ref,
) {
  return <label ref={ref} className={cn("num-stamp block", className)} {...rest} />;
});
