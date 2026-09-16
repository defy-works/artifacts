import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/providers/Providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Artifacts", template: "%s · Artifacts" },
  description: "Publish and share interactive pages from Claude Code.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/favicon-192.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="relative min-h-dvh bg-ink text-white antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {/* Ambient backdrop, same as the cost dashboard: fixed and behind
            everything, so content never fights a scrolling texture. */}
        <div className="grid-hairlines pointer-events-none fixed inset-0 z-0" aria-hidden />
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px]"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(99,102,241,0.16) 0%, transparent 70%)" }}
          aria-hidden
        />
        <Providers>
          <main id="main" className="relative z-10">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
