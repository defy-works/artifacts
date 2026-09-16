"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, artifactUrl } from "@/lib/bridge/api";
import { Badge, levelVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { ArtifactSummary } from "@/components/gallery/Gallery";

interface Share {
  email: string;
  role: string;
}

const LINK_OPTIONS = [
  { value: "none", label: "Only people invited by email" },
  { value: "view", label: "Anyone with the link can view" },
  { value: "interact", label: "Anyone with the link can interact" },
  { value: "edit", label: "Anyone with the link can edit" },
];

export function ShareDialog({
  open,
  onClose,
  artifact,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  artifact: ArtifactSummary;
  onChanged: () => void;
}) {
  const [linkAccess, setLinkAccess] = useState(artifact.linkAccess);
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("view");
  const [busy, setBusy] = useState(false);
  const url = artifactUrl(artifact.slug, "/share");

  useEffect(() => {
    if (!open) return;
    api.get(url).then((r) => {
      setLinkAccess(r.linkAccess);
      setShares(r.shares);
    });
  }, [open, url]);

  async function apply(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await api.put(url, body);
      setLinkAccess(r.linkAccess);
      setShares(r.shares);
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const share = `${typeof window === "undefined" ? "" : window.location.origin}/a/${artifact.slug}`;
  const restricted = Object.keys(artifact.capabilities ?? {}).some((c) => c === "assets");

  return (
    <Dialog open={open} onClose={onClose} eyebrow="Share" title={artifact.title}>
      <div className="space-y-5">
        <div>
          <Label className="mb-1.5">Link access</Label>
          <Select value={linkAccess} disabled={busy} onChange={(e) => apply({ linkAccess: e.target.value })}>
            {LINK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={share} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(share);
                toast.success("Link copied");
              }}
            >
              Copy
            </Button>
          </div>
          {restricted && linkAccess !== "none" && (
            <p className="mt-2 text-[11px] text-amber-300/80">
              Asset uploads stay limited to editors; link visitors with edit access can upload.
            </p>
          )}
        </div>

        <div>
          <Label className="mb-1.5">Invite by email</Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email) return;
              apply({ add: [{ email, role }] }).then(() => setEmail(""));
            }}
          >
            <Input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-32">
              <option value="view">Can view</option>
              <option value="interact">Can interact</option>
              <option value="edit">Can edit</option>
            </Select>
            <Button type="submit" disabled={busy}>
              Add
            </Button>
          </form>
          <ul className="mt-3 divide-y divide-white/10">
            {shares.map((s) => (
              <li key={s.email} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{s.email}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={levelVariant(s.role)}>{s.role}</Badge>
                  <Select
                    value={s.role}
                    className="h-8 w-28 py-1 text-xs"
                    onChange={(e) => apply({ add: [{ email: s.email, role: e.target.value }] })}
                  >
                    <option value="view">view</option>
                    <option value="interact">interact</option>
                    <option value="edit">edit</option>
                  </Select>
                  <Button size="xs" variant="ghost" onClick={() => apply({ remove: [s.email] })}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] leading-relaxed text-white/45">
          <strong className="text-white/70">View</strong> reads the page and shared data. <strong className="text-white/70">Interact</strong> also writes
          shared data and sends room events the page opens. <strong className="text-white/70">Edit</strong> also publishes versions, files
          and assets.
        </p>
      </div>
    </Dialog>
  );
}
