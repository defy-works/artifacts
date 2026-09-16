"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/bridge/api";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

interface Token {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokensPanel({ initial, site }: { initial: Token[]; site: string }) {
  const [tokens, setTokens] = useState(initial);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/api/v1/tokens", { name });
      setFresh({ token: r.token, name: r.name });
      setTokens([...tokens, { id: r.id, name: r.name, prefix: r.prefix, createdAt: r.createdAt, lastUsedAt: null }]);
      setName("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Anything using it stops working.")) return;
    await api.delete(`/api/v1/tokens/${id}`);
    setTokens(tokens.filter((t) => t.id !== id));
  }

  const setup = fresh ? `bunx @defyworks/artifacts login --url ${site} --token ${fresh.token}` : "";

  return (
    <div className="space-y-6">
      {fresh && (
        <div className="glass-strong border-indigo-400/40 p-5">
          <div className="num-stamp mb-2">Copy now — shown once</div>
          <p className="mb-3 text-sm">
            Token <strong>{fresh.name}</strong> created. Connect the CLI and the Claude Code skill with:
          </p>
          <pre className="code-block thin-scroll">{setup}</pre>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(setup);
                toast.success("Copied");
              }}
            >
              Copy setup command
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFresh(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={create} className="glass flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-48 flex-1">
          <Label htmlFor="tokenName" className="mb-1.5">
            New token name
          </Label>
          <Input id="tokenName" value={name} onChange={(e) => setName(e.target.value)} placeholder="laptop" required />
        </div>
        <Button type="submit" disabled={busy}>
          Create token
        </Button>
      </form>

      <div className="glass divide-y divide-white/10 p-0">
        {tokens.length === 0 && <p className="p-5 text-sm text-white/50">No tokens yet.</p>}
        {tokens.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="text-sm font-medium">{t.name}</div>
              <div className="tnum mt-0.5 font-mono text-[11px] text-white/45">
                {t.prefix}… · created {timeAgo(t.createdAt)}
                {t.lastUsedAt ? ` · used ${timeAgo(t.lastUsedAt)}` : " · never used"}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => revoke(t.id)}>
              Revoke
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
