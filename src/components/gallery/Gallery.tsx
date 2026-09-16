"use client";

import { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/bridge/api";
import { capabilityList, timeAgo } from "@/lib/format";
import { Badge, levelVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { MetricTile } from "@/components/ui/Card";
import { STARTER_HTML } from "./starter";

export interface ArtifactSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  favicon: string | null;
  capabilities: Record<string, unknown>;
  linkAccess: string;
  versionCount: number;
  updatedAt: string;
  level: string;
  ownerName: string;
  url: string;
}

function Card({ a, index }: { a: ArtifactSummary; index: number }) {
  const caps = capabilityList(a.capabilities);
  return (
    <NextLink
      href={`/a/${a.slug}`}
      className="glass group flex flex-col gap-3 p-5 transition-[border-color,transform] duration-[var(--duration-normal)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-indigo-400/50"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-2xl leading-none">{a.favicon || "▣"}</span>
        <Badge variant={levelVariant(a.level)}>{a.level}</Badge>
      </div>
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight group-hover:text-indigo-200">{a.title}</h3>
        {a.description && <p className="mt-1 line-clamp-2 text-xs text-white/60">{a.description}</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/45">
        <span className="font-mono">v{a.versionCount}</span>
        <span>{timeAgo(a.updatedAt)}</span>
        {a.linkAccess !== "none" && <span className="text-indigo-300/80">link · {a.linkAccess}</span>}
        {caps.length > 0 && <span className="font-mono text-white/35">{caps.join(" ")}</span>}
      </div>
    </NextLink>
  );
}

export function Gallery({ owned, shared, site }: { owned: ArtifactSummary[]; shared: ArtifactSummary[]; site: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const t = title.trim() || "Untitled";
      const r = await api.post("/api/v1/artifacts", {
        title: t,
        html: STARTER_HTML(t),
        capabilities: { db: {}, room: {}, artifact: {} },
      });
      router.push(`/a/${r.artifact.slug}/edit`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const versions = owned.reduce((n, a) => n + a.versionCount, 0);
  const linked = owned.filter((a) => a.linkAccess !== "none").length;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="num-stamp mb-2">01 — Gallery</div>
          <h1 className="font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">Your artifacts</h1>
        </div>
        <Button onClick={() => setOpen(true)}>New artifact</Button>
      </div>

      <div className="rise-in mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile label="Published" value={owned.length} hint="Artifacts you own." />
        <MetricTile label="Versions" value={versions} hint="Across everything you own; each publish adds one." />
        <MetricTile label="Open by link" value={linked} hint="Owned artifacts anyone with the link can open." />
        <MetricTile label="Shared with you" value={shared.length} hint="Invited by email to someone else's artifact." />
      </div>

      {owned.length === 0 ? (
        <div className="glass p-8">
          <span className="num-stamp">Nothing published yet</span>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em]">Publish your first page</h2>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">
            Create a starter page here, or publish from Claude Code. Install the skill once, connect it with an API
            token, then ask Claude to publish a page.
          </p>
          <pre className="code-block mt-5">{`bunx skills add defy-works/artifacts --skill artifacts -g -a claude-code
bunx @defyworks/artifacts login --url ${site} --token art_…
bunx @defyworks/artifacts publish page.html --link view`}</pre>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {owned.map((a, i) => (
            <Card key={a.id} a={a} index={i} />
          ))}
        </div>
      )}

      {shared.length > 0 && (
        <>
          <div className="mt-14 mb-6">
            <div className="num-stamp mb-2">02 — Shared with you</div>
            <div className="hairline" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((a, i) => (
              <Card key={a.id} a={a} index={i} />
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} eyebrow="New artifact" title="Start a page">
        <form onSubmit={create} className="space-y-4">
          <div>
            <Label htmlFor="title" className="mb-1.5">
              Title
            </Label>
            <Input id="title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly retro board" />
          </div>
          <p className="text-xs text-white/50">
            A starter page with the runtime wired up. You can edit the HTML in the browser or overwrite it from Claude
            Code.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
