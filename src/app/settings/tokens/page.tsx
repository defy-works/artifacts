import { redirect } from "next/navigation";
import { getViewer } from "@/lib/access";
import { listTokens } from "@/lib/services/tokens";
import { Header } from "@/components/shell/Header";
import { TokensPanel } from "./TokensPanel";

export const metadata = { title: "API tokens" };
export const dynamic = "force-dynamic";

export default async function TokensPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?from=/settings/tokens");
  const tokens = await listTokens(viewer.id);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return (
    <div className="min-h-[100dvh]">
      <Header />
      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <div className="num-stamp mb-2">02 — API tokens</div>
        <h1 className="mb-2 font-display text-4xl font-bold tracking-[-0.03em]">Claude Code access</h1>
        <p className="mb-8 max-w-xl text-sm text-white/60">
          Tokens let the <code className="font-mono text-indigo-300">artifacts</code> skill publish and manage pages
          as you. Treat them like passwords.
        </p>
        <TokensPanel initial={tokens} site={site} />
      </div>
    </div>
  );
}
