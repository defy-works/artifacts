import type { ReactNode } from "react";
import NextLink from "next/link";
import { Header } from "@/components/shell/Header";

/** Prose layout for privacy / terms pages, in the defy.works editorial grammar. */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh]">
      <Header />
      <article className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="num-stamp mb-3">{eyebrow}</div>
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">{title}</h1>
        <p className="mt-3 text-xs text-white/45">Last updated {updated}</p>
        <div className="hairline my-8" />
        <div className="legal-prose">{children}</div>
        <div className="hairline my-10" />
        <p className="text-xs text-white/45">
          <NextLink href="/privacy" className="text-indigo-300 hover:underline">
            Privacy policy
          </NextLink>{" "}
          ·{" "}
          <NextLink href="/terms" className="text-indigo-300 hover:underline">
            Terms of service
          </NextLink>{" "}
          · defy.works
        </p>
      </article>
    </div>
  );
}
