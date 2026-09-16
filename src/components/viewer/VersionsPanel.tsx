"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, artifactUrl } from "@/lib/bridge/api";
import type { RealtimeClient } from "@/lib/bridge/realtime-client";
import { bytes, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "./SidePanel";
import { PanelSkeleton } from "@/components/ui/Card";

interface VersionRow {
  id: string;
  number: number;
  label: string | null;
  size: number;
  createdAt: string;
  creatorName: string | null;
}

export function VersionsPanel({
  slug,
  current,
  level,
  realtime,
  onClose,
}: {
  slug: string;
  current: string | null;
  level: string;
  realtime: RealtimeClient;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<VersionRow[] | null>(null);
  const canEdit = level === "edit" || level === "owner";

  useEffect(() => {
    const load = () =>
      api
        .get(artifactUrl(slug, "/versions"))
        .then((r) => setRows(r.versions))
        .catch(() => {});
    load();
    return realtime.on("version", load);
  }, [slug, realtime]);

  async function restore(v: VersionRow) {
    if (!confirm(`Restore v${v.number} as a new version?`)) return;
    try {
      await api.post(artifactUrl(slug, `/versions/${v.id}/restore`), {});
      toast.success(`Restored v${v.number}`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <SidePanel title="Versions" onClose={onClose}>
      {!rows ? (
        <PanelSkeleton />
      ) : (
        <ul className="divide-y divide-white/10">
          {rows.map((v) => (
            <li key={v.id} className={cn("px-4 py-3", v.id === current && "bg-indigo-500/8")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">
                  v{v.number}
                  {v.id === current && <span className="ml-2 text-indigo-300">live</span>}
                </span>
                <span className="tnum text-[11px] text-white/45">{timeAgo(v.createdAt)}</span>
              </div>
              <div className="mt-1 text-[11px] text-white/55">
                {v.label ? `${v.label} · ` : ""}
                {v.creatorName ?? "someone"} · {bytes(v.size)}
              </div>
              <div className="mt-2 flex gap-2">
                <a
                  href={artifactUrl(slug, `/versions/${v.id}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-300 hover:underline"
                >
                  Raw
                </a>
                {canEdit && v.id !== current && (
                  <Button size="xs" variant="ghost" onClick={() => restore(v)}>
                    Restore
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SidePanel>
  );
}
