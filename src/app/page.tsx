import NextLink from "next/link";
import { getViewer } from "@/lib/access";
import { listForViewer } from "@/lib/services/artifacts";
import { Header } from "@/components/shell/Header";
import { Gallery } from "@/components/gallery/Gallery";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getViewer();

  if (!viewer) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <Header />
        <section className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
          <div className="num-stamp mb-4">01 — Publish from Claude Code</div>
          <h1 className="rise-in font-display text-5xl font-bold tracking-[-0.04em] sm:text-7xl">
            Artifacts,
            <br />
            <span className="outlined [--outline-stroke:var(--color-indigo-300)]">self-hosted.</span>
          </h1>
          <p className="mt-6 max-w-md text-balance text-sm text-white/65 sm:text-base">
            Interactive pages with a live database, presence and assets built in. Shared with anyone, view or
            edit.
          </p>
          <div className="mt-10 flex gap-3">
            <NextLink href="/login">
              <Button size="lg">Sign in</Button>
            </NextLink>
          </div>
        </section>
        <footer className="px-6 pb-8 text-center text-[11px] text-white/40">
          <NextLink href="/privacy" className="hover:text-white">Privacy</NextLink> ·{" "}
          <NextLink href="/terms" className="hover:text-white">Terms</NextLink> · © 2026 defy.works
        </footer>
      </div>
    );
  }

  const { owned, shared } = await listForViewer(viewer);
  return (
    <div className="min-h-[100dvh]">
      <Header />
      <Gallery owned={owned} shared={shared} />
    </div>
  );
}
