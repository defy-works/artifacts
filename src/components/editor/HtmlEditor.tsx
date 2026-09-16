"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, artifactUrl } from "@/lib/bridge/api";
import { prepareHtml, SANDBOX } from "@/lib/serve-html";
import { bytes } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { ArtifactSummary } from "@/components/gallery/Gallery";

interface FileRow {
  path: string;
  size: number;
  contentType: string;
}

const CAPS = ["db", "room", "artifact", "assets", "downloads"] as const;

export function HtmlEditor({
  artifact,
  version,
  html: initialHtml,
  files: initialFiles,
  level,
}: {
  artifact: ArtifactSummary;
  version: { id: string; number: number } | null;
  html: string;
  files: FileRow[];
  level: string;
}) {
  const router = useRouter();
  const [html, setHtml] = useState(initialHtml);
  const [title, setTitle] = useState(artifact.title);
  const [description, setDescription] = useState(artifact.description ?? "");
  const [favicon, setFavicon] = useState(artifact.favicon ?? "");
  const [caps, setCaps] = useState<Record<string, unknown>>(artifact.capabilities ?? {});
  const [rulesText, setRulesText] = useState(JSON.stringify(caps, null, 2));
  const [files, setFiles] = useState(initialFiles);
  const [preview, setPreview] = useState(initialHtml);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"code" | "settings" | "files">("code");
  const [versionId, setVersionId] = useState(version?.id ?? null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dirty = html !== initialHtml;

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const srcdoc = useMemo(
    () => (origin ? prepareHtml(preview, { origin, artifactId: artifact.id, hasFiles: files.length > 0 }) : ""),
    [preview, origin, artifact.id, files.length],
  );

  async function publish() {
    setBusy(true);
    try {
      let capabilities = caps;
      try {
        capabilities = JSON.parse(rulesText);
      } catch {
        toast.error("Capabilities JSON is invalid");
        return;
      }
      const r = await api.put(artifactUrl(artifact.slug), {
        html: dirty ? html : undefined,
        title,
        description,
        favicon,
        capabilities,
        ifVersion: dirty ? (versionId ?? undefined) : undefined,
      });
      if (r.version) {
        setVersionId(r.version.id);
        toast.success(`Published v${r.version.number}`);
      } else toast.success("Saved");
      setCaps(capabilities);
      router.refresh();
    } catch (err) {
      const e = err as { code?: string; message: string };
      if (e.code === "conflict") toast.error("Someone published a newer version. Reload to see it.");
      else toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(list: FileList | null) {
    if (!list) return;
    for (const f of Array.from(list)) {
      try {
        const r = await api.raw("PUT", artifactUrl(artifact.slug, `/files/${encodeURIComponent(f.name)}`), f, f.type || "application/octet-stream");
        setFiles((prev) => [...prev.filter((x) => x.path !== r.file.path), { path: r.file.path, size: r.file.size, contentType: r.file.contentType }]);
      } catch (err) {
        toast.error(`${f.name}: ${(err as Error).message}`);
      }
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-ink">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3 sm:px-4">
        <NextLink href={`/a/${artifact.slug}`} className="flex items-center gap-2 text-xs text-white/60 hover:text-white">
          ← Back to page
        </NextLink>
        <span className="h-5 w-px bg-white/15" />
        <h1 className="truncate font-display text-sm font-semibold tracking-tight">{title}</h1>
        <span className="font-mono text-[10px] text-white/40">{level}</span>
        <div className="ml-auto flex items-center gap-1">
          {(["code", "settings", "files"] as const).map((t) => (
            <Button key={t} size="xs" variant="ghost" className={cn(tab === t && "bg-white/8 text-white")} onClick={() => setTab(t)}>
              {t}
            </Button>
          ))}
          <Button size="xs" variant="secondary" onClick={() => setPreview(html)} disabled={html === preview}>
            Preview
          </Button>
          <Button size="xs" onClick={publish} disabled={busy}>
            {dirty ? "Publish" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-1/2 min-w-0 flex-col border-r border-white/10">
          {tab === "code" && (
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
              className="code-editor thin-scroll h-full w-full flex-1 bg-shadow p-4 text-white/90 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const s = el.selectionStart;
                  setHtml(html.slice(0, s) + "  " + html.slice(el.selectionEnd));
                  requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
                }
                if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                  e.preventDefault();
                  publish();
                }
              }}
            />
          )}
          {tab === "settings" && (
            <div className="thin-scroll space-y-5 overflow-y-auto p-5">
              <div>
                <Label className="mb-1.5">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5">Favicon (emoji)</Label>
                <Input value={favicon} onChange={(e) => setFavicon(e.target.value)} className="w-24" maxLength={4} />
              </div>
              <div>
                <Label className="mb-1.5">Capabilities</Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {CAPS.map((c) => {
                    let current: Record<string, unknown> = {};
                    try {
                      current = JSON.parse(rulesText);
                    } catch {
                      /* keep */
                    }
                    const on = c in current;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const next = { ...current };
                          if (on) delete next[c];
                          else next[c] = {};
                          setRulesText(JSON.stringify(next, null, 2));
                        }}
                        className={cn(
                          "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                          on ? "border-indigo-400 bg-indigo-500/20 text-indigo-200" : "border-white/15 text-white/50 hover:text-white",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  spellCheck={false}
                  className="code-editor thin-scroll h-56 w-full rounded-md border border-white/12 bg-white/4 p-3 text-white/85 outline-none focus:border-indigo-500"
                />
                <p className="mt-2 text-[11px] leading-relaxed text-white/45">
                  Same shape as the Claude Code Artifact tool: <code className="font-mono">{`{"db": {"rules": [...]}, "room": {"topics": {...}}}`}</code>
                </p>
              </div>
              <div>
                <Label className="mb-1.5">Link access</Label>
                <Select
                  defaultValue={artifact.linkAccess}
                  disabled={level !== "owner"}
                  onChange={(e) => api.put(artifactUrl(artifact.slug, "/share"), { linkAccess: e.target.value }).then(() => toast.success("Updated")).catch((err) => toast.error(err.message))}
                >
                  <option value="none">Invited only</option>
                  <option value="view">Anyone with link · view</option>
                  <option value="interact">Anyone with link · interact</option>
                  <option value="edit">Anyone with link · edit</option>
                </Select>
              </div>
            </div>
          )}
          {tab === "files" && (
            <div className="thin-scroll overflow-y-auto p-5">
              <p className="mb-3 text-xs text-white/55">
                Supporting files are served next to the page; reference them with relative paths (<code className="font-mono">data/rows.json</code>,{" "}
                <code className="font-mono">app.js</code>).
              </p>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
              <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                Upload files
              </Button>
              <ul className="mt-4 divide-y divide-white/10">
                {files.map((f) => (
                  <li key={f.path} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-mono">{f.path}</span>
                    <span className="flex items-center gap-3 text-white/45">
                      {bytes(f.size)}
                      <button
                        type="button"
                        className="hover:text-red-300"
                        onClick={() =>
                          api.delete(artifactUrl(artifact.slug, `/files/${f.path.split("/").map(encodeURIComponent).join("/")}`)).then(() => setFiles(files.filter((x) => x.path !== f.path)))
                        }
                      >
                        delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="w-1/2 min-w-0 bg-white">
          <iframe title="Preview" className="artifact-frame" sandbox={SANDBOX} srcDoc={srcdoc} />
        </div>
      </div>
    </div>
  );
}
