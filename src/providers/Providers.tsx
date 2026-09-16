"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "rgba(17, 18, 23, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            color: "white",
            backdropFilter: "blur(10px)",
            fontFamily: "var(--font-display)",
          },
        }}
      />
    </>
  );
}
