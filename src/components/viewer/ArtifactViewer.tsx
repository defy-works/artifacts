"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api, artifactUrl } from "@/lib/bridge/api";
import { BridgeHost, type HostLevel } from "@/lib/bridge/host";
import { RealtimeClient } from "@/lib/bridge/realtime-client";
import { prepareHtml, SANDBOX } from "@/lib/serve-html";
import { bytes } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ViewerChrome, type Panel } from "./ViewerChrome";
import { ShareDialog } from "./ShareDialog";
import { VersionsPanel } from "./VersionsPanel";
import { CommentsPanel } from "./CommentsPanel";
import type { ArtifactSummary } from "@/components/gallery/Gallery";

export interface ViewerInitial {
  artifact: ArtifactSummary;
  html: string;
  version: { id: string; number: number } | null;
  hasFiles: boolean;
  level: HostLevel;
  viewer: { id: string; name: string; email: string } | null;
}

type Prompt = { kind: "download"; filename: string; size: number; resolve: (ok: boolean) => void };

export function ArtifactViewer({ initial }: { initial: ViewerInitial }) {
  const [artifact, setArtifact] = useState(initial.artifact);
  const [html, setHtml] = useState(initial.html);
  const [version, setVersion] = useState(initial.version);
  const [hasFiles, setHasFiles] = useState(initial.hasFiles);
  const [panel, setPanel] = useState<Panel>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [peers, setPeers] = useState(0);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const realtime = useMemo(() => new RealtimeClient(initial.artifact.slug), [initial.artifact.slug]);
  // Resolved after mount so the server and first client render agree (empty srcdoc).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const srcdoc = useMemo(
    () => (origin ? prepareHtml(html, { origin, artifactId: artifact.id, hasFiles }) : ""),
    [html, origin, artifact.id, hasFiles],
  );

  const refetch = useCallback(async () => {
    try {
      const r = await api.get(artifactUrl(initial.artifact.slug));
      setArtifact(r.artifact);
      setHasFiles(r.files.length > 0);
      if (r.version && r.version.id !== version?.id) {
        setVersion({ id: r.version.id, number: r.version.number });
        setHtml(r.html);
      }
    } catch {
      /* transient */
    }
  }, [initial.artifact.slug, version?.id]);

  // Realtime stream: versions, meta, comments, presence count.
  useEffect(() => {
    realtime.connect();
    const offs = [
      realtime.on("version", () => refetch()),
      realtime.on("meta", () => refetch()),
      realtime.on("deleted", () => setDeleted(true)),
      realtime.on("peers", (d: { peers: unknown[] }) => setPeers(d.peers.length)),
      realtime.onConnection(setConnected),
    ];
    return () => {
      offs.forEach((f) => f());
      realtime.close();
    };
  }, [realtime, refetch]);

  // Comment count for the chrome badge.
  useEffect(() => {
    const load = () =>
      api
        .get(artifactUrl(initial.artifact.slug, "/comments"))
        .then((r) => setCommentCount(r.comments.filter((c: { resolved: boolean }) => !c.resolved).length))
        .catch(() => {});
    load();
    return realtime.on("comments", load);
  }, [realtime, initial.artifact.slug]);

  // One bridge per mounted frame version.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !srcdoc) return;
    const host = new BridgeHost({
      iframe,
      artifact: { id: artifact.id, slug: artifact.slug, capabilities: artifact.capabilities, currentVersionId: version?.id ?? null },
      level: initial.level,
      uid: initial.viewer?.id ?? null,
      viewer: initial.viewer,
      realtime,
      confirmDownload: ({ filename, size }) =>
        new Promise((resolve) => setPrompt({ kind: "download", filename, size, resolve })),
      onPublished: (v) => toast.success(`Published v${v.number}`),
    });
    return () => host.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcdoc, artifact.id, artifact.slug, artifact.capabilities, initial.level, initial.viewer?.id, realtime]);

  const answer = (ok: boolean) => {
    prompt?.resolve(ok);
    setPrompt(null);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-ink">
      <ViewerChrome
        artifact={artifact}
        version={version}
        level={initial.level}
        viewer={initial.viewer}
        peers={peers}
        connected={connected}
        commentCount={commentCount}
        panel={panel}
        onPanel={(p) => setPanel(panel === p ? null : p)}
        onShare={() => setShareOpen(true)}
      />
      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-white">
          {deleted ? (
            <div className="flex h-full items-center justify-center bg-ink text-sm text-white/60">
              This artifact was deleted.
            </div>
          ) : (
            <iframe
              key={version?.id ?? "v0"}
              ref={iframeRef}
              title={artifact.title}
              className="artifact-frame"
              sandbox={SANDBOX}
              allow="clipboard-write; fullscreen; camera; microphone; geolocation"
              srcDoc={srcdoc}
              referrerPolicy="no-referrer"
            />
          )}
        </div>
        {panel === "versions" && (
          <VersionsPanel slug={artifact.slug} current={version?.id ?? null} level={initial.level} realtime={realtime} onClose={() => setPanel(null)} />
        )}
        {panel === "comments" && (
          <CommentsPanel slug={artifact.slug} viewer={initial.viewer} level={initial.level} realtime={realtime} onClose={() => setPanel(null)} />
        )}
      </div>

      {initial.level === "owner" && (
        <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} artifact={artifact} onChanged={refetch} />
      )}

      <Dialog
        open={prompt?.kind === "download"}
        onClose={() => answer(false)}
        eyebrow="This page wants to save a file"
        title={prompt?.kind === "download" ? prompt.filename : ""}
      >
        {prompt?.kind === "download" && (
          <>
            <p className="text-sm text-white/65">
              {bytes(prompt.size)} · generated by the page, not by this site.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => answer(false)}>
                Cancel
              </Button>
              <Button onClick={() => answer(true)}>Save</Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
