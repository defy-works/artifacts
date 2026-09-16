"use client";

import type { ReactNode } from "react";

export function SidePanel({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <aside className="flex w-full max-w-[22rem] shrink-0 flex-col border-l border-white/10 bg-ink text-white sm:w-[22rem]">
      <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
        <span className="num-stamp">{title}</span>
        <button type="button" onClick={onClose} className="text-white/50 hover:text-white" aria-label="Close panel">
          ×
        </button>
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="border-t border-white/10 p-3">{footer}</div>}
    </aside>
  );
}
