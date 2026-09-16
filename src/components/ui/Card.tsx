import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

/** Glass surface. Uses the `.glass` utility registered in globals.css. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, ...rest }, ref) {
  return <div ref={ref} className={cn("glass p-5", className)} {...rest} />;
});

export const CardHeader = forwardRef<HTMLDivElement, CardProps>(function CardHeader({ className, ...rest }, ref) {
  return <div ref={ref} className={cn("flex items-baseline justify-between gap-3 pb-4", className)} {...rest} />;
});

/** The mono all-caps label that titles every panel. */
export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function CardTitle(
  { className, ...rest },
  ref,
) {
  return <h2 ref={ref} className={cn("num-stamp", className)} {...rest} />;
});

/**
 * One big number with a mono label above and context below (from the
 * cost dashboard). `hint` is the sentence that stops the number being
 * misread.
 */
export function MetricTile({
  label,
  value,
  hint,
  accent,
  trailing,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass flex flex-col justify-between p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="num-stamp">{label}</span>
        {trailing}
      </div>
      <div className={cn("metric-xl mt-4", accent ?? "text-white")}>{value}</div>
      {hint && <p className="mt-2.5 text-xs leading-relaxed text-white/45">{hint}</p>}
    </div>
  );
}

/** Shimmer rows for a panel that is still loading. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="shimmer-bar h-10 rounded-md" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}
