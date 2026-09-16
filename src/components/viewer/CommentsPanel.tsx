"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { toast } from "sonner";
import { api, artifactUrl } from "@/lib/bridge/api";
import type { RealtimeClient } from "@/lib/bridge/realtime-client";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { SidePanel } from "./SidePanel";
import { PanelSkeleton } from "@/components/ui/Card";

interface CommentRow {
  id: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  body: string;
  resolved: boolean;
  createdAt: string;
}

export function CommentsPanel({
  slug,
  viewer,
  level,
  realtime,
  onClose,
}: {
  slug: string;
  viewer: { id: string; name: string } | null;
  level: string;
  realtime: RealtimeClient;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<CommentRow[] | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEditor = level === "edit" || level === "owner";

  useEffect(() => {
    const load = () =>
      api
        .get(artifactUrl(slug, "/comments"))
        .then((r) => setRows(r.comments))
        .catch(() => {});
    load();
    return realtime.on("comments", load);
  }, [slug, realtime]);

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.post(artifactUrl(slug, "/comments"), { body, parentId: replyTo });
      setBody("");
      setReplyTo(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const roots = (rows ?? []).filter((c) => !c.parentId);
  const replies = (id: string) => (rows ?? []).filter((c) => c.parentId === id);

  return (
    <SidePanel
      title="Comments"
      onClose={onClose}
      footer={
        viewer ? (
          <div className="space-y-2">
            {replyTo && (
              <div className="flex items-center justify-between text-[11px] text-white/50">
                <span>Replying in thread</span>
                <button type="button" onClick={() => setReplyTo(null)} className="hover:text-white">
                  cancel
                </button>
              </div>
            )}
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a comment"
              className="min-h-16 text-xs"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
              }}
            />
            <div className="flex justify-end">
              <Button size="sm" disabled={busy || !body.trim()} onClick={send}>
                Post
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/50">
            <NextLink href={`/login?from=/a/${slug}`} className="text-indigo-300 hover:underline">
              Sign in
            </NextLink>{" "}
            to comment.
          </p>
        )
      }
    >
      {!rows ? (
        <PanelSkeleton />
      ) : roots.length === 0 ? (
        <p className="p-4 text-xs text-white/50">No comments yet.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {roots.map((c) => (
            <li key={c.id} className={cn("px-4 py-3", c.resolved && "opacity-50")}>
              <CommentItem c={c} viewer={viewer} isEditor={isEditor} slug={slug} onReply={() => setReplyTo(c.id)} root />
              {replies(c.id).map((r) => (
                <div key={r.id} className="mt-2 border-l border-white/10 pl-3">
                  <CommentItem c={r} viewer={viewer} isEditor={isEditor} slug={slug} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}

function CommentItem({
  c,
  viewer,
  isEditor,
  slug,
  onReply,
  root,
}: {
  c: CommentRow;
  viewer: { id: string } | null;
  isEditor: boolean;
  slug: string;
  onReply?: () => void;
  root?: boolean;
}) {
  const mine = viewer?.id === c.authorId;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold">{c.authorName}</span>
        <span className="text-[10px] text-white/40">{timeAgo(c.createdAt)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-white/80">{c.body}</p>
      {viewer && (
        <div className="mt-1.5 flex gap-3 text-[10px] text-white/45">
          {root && onReply && (
            <button type="button" onClick={onReply} className="hover:text-white">
              Reply
            </button>
          )}
          {root && (mine || isEditor) && (
            <button
              type="button"
              className="hover:text-white"
              onClick={() => api.patch(artifactUrl(slug, `/comments/${c.id}`), { resolved: !c.resolved })}
            >
              {c.resolved ? "Reopen" : "Resolve"}
            </button>
          )}
          {(mine || isEditor) && (
            <button
              type="button"
              className="hover:text-red-300"
              onClick={() => confirm("Delete this comment?") && api.delete(artifactUrl(slug, `/comments/${c.id}`))}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
