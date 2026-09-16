"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  /** Block dismissal by backdrop / escape (consent prompts). */
  modal?: boolean;
}

/** Glass modal on the native <dialog> element. */
export function Dialog({ open, onClose, title, eyebrow, children, className, modal }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!modal) onClose();
      }}
      onClick={(e) => {
        if (!modal && e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,32rem)] bg-transparent p-0 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        "open:animate-[rise-in_320ms_var(--ease-out-soft)]",
      )}
    >
      <div className={cn("glass-strong p-6 shadow-glass", className)}>
        {eyebrow && <div className="num-stamp mb-2">{eyebrow}</div>}
        {title && <h2 className="mb-4 font-display text-xl font-bold tracking-tight">{title}</h2>}
        {children}
      </div>
    </dialog>
  );
}
