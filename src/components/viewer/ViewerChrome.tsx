"use client";

import NextLink from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Badge, levelVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { ArtifactSummary } from "@/components/gallery/Gallery";

export type Panel = "versions" | "comments" | null;

interface Props {
  artifact: ArtifactSummary;
  version: { id: string; number: number } | null;
  level: string;
  viewer: { id: string; name: string; email: string } | null;
  peers: number;
  connected: boolean;
  commentCount: number | null;
  panel: Panel;
  onPanel: (p: Exclude<Panel, null>) => void;
  onShare: () => void;
}

export function ViewerChrome({ artifact, version, level, viewer, peers, connected, commentCount, panel, onPanel, onShare }: Props) {
  const canEdit = level === "edit" || level === "owner";

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-ink px-3 sm:px-4">
      <NextLink href="/" className="flex shrink-0 items-center gap-2" aria-label="Gallery">
        <img src="/logo/artifacts-mark.svg" alt="" aria-hidden className="h-6 w-6" />
      </NextLink>
      <span className="hidden h-5 w-px bg-white/15 sm:block" />

      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="text-lg leading-none">{artifact.favicon || "▣"}</span>
        <h1 className="truncate font-display text-sm font-semibold tracking-tight">{artifact.title}</h1>
        {version && <span className="hidden font-mono text-[10px] text-white/40 sm:inline">v{version.number}</span>}
        <Badge variant={levelVariant(level)} className="hidden sm:inline-flex">
          {level}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <span
          className="hidden items-center gap-1.5 px-2 font-mono text-[10px] text-white/45 md:flex"
          title={connected ? "Live" : "Reconnecting…"}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success" : "bg-warning pulse-dot")} />
          {peers > 0 ? `${peers} here` : "live"}
        </span>
        <Button variant="ghost" size="xs" onClick={() => onPanel("comments")} className={cn(panel === "comments" && "bg-white/8 text-white")}>
          Comments{commentCount ? ` · ${commentCount}` : ""}
        </Button>
        <Button variant="ghost" size="xs" onClick={() => onPanel("versions")} className={cn(panel === "versions" && "bg-white/8 text-white")}>
          Versions
        </Button>
        {canEdit && (
          <NextLink href={`/a/${artifact.slug}/edit`}>
            <Button variant="ghost" size="xs">
              Code
            </Button>
          </NextLink>
        )}
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link copied");
          }}
        >
          Copy link
        </Button>
        {level === "owner" ? (
          <Button size="xs" onClick={onShare}>
            Share
          </Button>
        ) : !viewer ? (
          <NextLink href={`/login?from=/a/${artifact.slug}`}>
            <Button size="xs" variant="secondary">
              Sign in
            </Button>
          </NextLink>
        ) : null}
      </div>
    </div>
  );
}
