"use client";

/**
 * Host side of the artifact runtime. Receives `use`/`call`/`subscribe`
 * messages from the sandboxed frame and fulfils them against the API and
 * the artifact's realtime stream. One instance per mounted frame.
 */
import { api, artifactUrl, ClientApiError } from "./api";
import type { RealtimeClient } from "./realtime-client";

export interface HostArtifact {
  id: string;
  slug: string;
  capabilities: Record<string, unknown>;
  currentVersionId: string | null;
}

export type HostLevel = "view" | "interact" | "edit" | "owner";
const RANK: Record<HostLevel, number> = { view: 1, interact: 2, edit: 3, owner: 4 };

export interface HostOptions {
  iframe: HTMLIFrameElement;
  artifact: HostArtifact;
  level: HostLevel;
  uid: string | null;
  viewer: { id: string; name: string; image?: string | null } | null;
  realtime: RealtimeClient;
  /** Show the viewer a download confirmation. Resolve true to proceed. */
  confirmDownload: (req: { filename: string; size: number }) => Promise<boolean>;
  /** A new version was published from inside the frame. */
  onPublished?: (version: { id: string; number: number }) => void;
}

type Sub = { close: () => void };

function err(code: string, message: string, extra?: Record<string, unknown>) {
  return { code, message, ...extra };
}

function toCapError(e: unknown, map: Record<string, string> = {}): { code: string; message: string } {
  if (e instanceof ClientApiError) return { code: map[e.code] ?? e.code, message: e.message };
  return { code: "unavailable", message: String((e as Error)?.message ?? e) };
}

const DOWNLOAD_EXT = new Set([
  "gif", "png", "jpg", "jpeg", "webp", "mp4", "webm", "txt", "json", "md",
  "docx", "pptx", "epub", "csv", "ttf", "html", "svg", "pdf", "xlsx", "zip",
]);
// Invisible / control characters stripped from filenames.
const INVISIBLE_RE = new RegExp("[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\ufeff]", "g");

export class BridgeHost {
  private subs = new Map<number, Sub>();
  private roomSubs = new Set<number>();
  private peer = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  private roomJoined = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private denied = new Set<string>();
  private onMessage = (ev: MessageEvent) => this.handle(ev);
  private onPageHide = () => this.dispose();
  private disposed = false;
  private off: Array<() => void> = [];

  constructor(private o: HostOptions) {
    window.addEventListener("message", this.onMessage);
    this.off.push(
      o.realtime.on("peers", (d) => this.broadcast("peers", d)),
      o.realtime.on("room", (d) => this.broadcast("room", d)),
      o.realtime.onConnection((c) => this.broadcast("connection", { connected: c })),
    );
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("pagehide", this.onPageHide);
    for (const s of this.subs.values()) s.close();
    this.subs.clear();
    this.off.forEach((f) => f());
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.roomJoined) {
      const body = JSON.stringify({ op: "leave", peer: this.peer });
      navigator.sendBeacon?.(
        artifactUrl(this.o.artifact.slug, "/room"),
        new Blob([body], { type: "application/json" }),
      );
    }
  }

  private broadcast(kind: string, payload: unknown) {
    for (const id of this.roomSubs) this.event(id, kind, payload);
  }

  private post(msg: Record<string, unknown>) {
    if (this.disposed) return;
    this.o.iframe.contentWindow?.postMessage({ __claude: 1, ...msg }, "*");
  }
  private result(id: number, value: unknown) {
    this.post({ type: "result", id, ok: true, value });
  }
  private fail(id: number, error: unknown) {
    this.post({ type: "result", id, ok: false, error });
  }
  private event(id: number, kind: string, payload: unknown) {
    this.post({ type: "event", id, kind, payload });
  }
  private subError(id: number, error: unknown) {
    this.subs.get(id)?.close();
    this.subs.delete(id);
    this.roomSubs.delete(id);
    this.event(id, "error", error);
  }

  private has(cap: string) {
    return cap in this.o.artifact.capabilities;
  }
  private atLeast(min: HostLevel) {
    return RANK[this.o.level] >= RANK[min];
  }
  private available(name: string): boolean {
    switch (name) {
      case "db":
      case "room":
      case "downloads":
      case "artifact":
        return this.has(name);
      case "assets":
        return this.has("assets") && this.atLeast("edit");
      case "permissions":
      case "user":
        return true;
      default:
        return false;
    }
  }

  private async handle(ev: MessageEvent) {
    if (ev.source !== this.o.iframe.contentWindow) return;
    const m = ev.data;
    if (!m || m.__claude !== 1) return;
    switch (m.type) {
      case "ready":
        this.post({ type: "hello", me: { peer: this.peer, uid: this.o.uid } });
        break;
      case "use":
        this.result(m.id, {
          available: this.available(m.name),
          me: { peer: this.peer, uid: this.o.uid },
        });
        break;
      case "call":
        try {
          this.result(m.id, await this.call(m.ns, m.method, m.args ?? []));
        } catch (e) {
          this.fail(m.id, (e as any)?.code ? e : toCapError(e));
        }
        break;
      case "subscribe":
        try {
          await this.subscribe(m.id, m.ns, m.method, m.args ?? []);
        } catch (e) {
          this.subError(m.id, (e as any)?.code ? e : toCapError(e));
        }
        break;
      case "unsubscribe":
        this.subs.get(m.id)?.close();
        this.subs.delete(m.id);
        this.roomSubs.delete(m.id);
        break;
    }
  }

  /* ---------------- calls ---------------- */

  private async call(ns: string, method: string, args: any[]): Promise<unknown> {
    if (!this.available(ns)) throw err("not_granted", `${ns} is not available in this view`);
    switch (ns) {
      case "db":
        return this.callDb(method, args);
      case "room":
        return this.callRoom(method, args);
      case "artifact":
        return this.callArtifact(method, args);
      case "assets":
        return this.callAssets(method, args);
      case "downloads":
        if (method !== "save") throw err("capability_removed", "downloads.save only");
        return this.saveDownload(args[0]);
      case "permissions":
        return this.callPermissions(method, args);
      case "user":
        return this.callUser(method, args);
    }
    throw err("capability_removed", `${ns} has no ${method}`);
  }

  private async callDb(method: string, args: any[]) {
    const url = artifactUrl(this.o.artifact.slug, "/db");
    const map = { forbidden: "invalid_argument", not_found: "invalid_argument" };
    try {
      switch (method) {
        case "get":
          return await api.post(url, { op: "get", path: args[0] });
        case "query":
          return await api.post(url, { op: "query", ...args[0] });
        case "set":
          await api.post(url, { op: "set", path: args[0], data: args[1] });
          return undefined;
        case "update":
          await api.post(url, { op: "update", path: args[0], data: args[1] });
          return undefined;
        case "delete":
          await api.post(url, { op: "delete", path: args[0] });
          return undefined;
        case "acquire":
          return await api.post(url, { op: "acquire", path: args[0], ...(args[1] ?? {}) });
      }
    } catch (e) {
      throw toCapError(e, map);
    }
    throw err("capability_removed", `db.${method} is not available`);
  }

  private async callRoom(method: string, args: any[]) {
    this.ensureRoom();
    const url = artifactUrl(this.o.artifact.slug, "/room");
    if (method === "emit") {
      try {
        await api.post(url, { op: "emit", peer: this.peer, topic: args[0], data: args[1] });
        return undefined;
      } catch (e) {
        throw toCapError(e, { forbidden: "not_permitted" });
      }
    }
    if (method === "presence") {
      try {
        await api.post(url, { op: "heartbeat", peer: this.peer, patch: args[0] ?? {} });
        return undefined;
      } catch (e) {
        throw toCapError(e);
      }
    }
    throw err("capability_removed", `room.${method} is not available`);
  }

  private async callArtifact(method: string, args: any[]) {
    if (method !== "publish") throw err("capability_removed", `artifact.${method} is not available`);
    if (!this.atLeast("edit")) throw err("not_writer", "This viewer cannot write this artifact");
    const slug = this.o.artifact.slug;
    const arg = args[0];
    if (typeof arg === "string") {
      if (!/^\s*<!doctype html/i.test(arg)) throw err("invalid_content", "html must begin with <!doctype html>");
      try {
        const r = await api.put(artifactUrl(slug), {
          html: arg,
          ifVersion: this.o.artifact.currentVersionId ?? undefined,
        });
        this.o.artifact.currentVersionId = r.version.id;
        this.o.onPublished?.(r.version);
        return { version: r.version.id };
      } catch (e) {
        throw toCapError(e, { forbidden: "not_writer" });
      }
    }
    if (arg && typeof arg === "object") {
      const shas: Record<string, string> = {};
      for (const [path, value] of Object.entries(arg as Record<string, any>)) {
        const url = artifactUrl(slug, "/files/" + path.split("/").map(encodeURIComponent).join("/"));
        if (value === null || (value && value.delete === true)) {
          await api.delete(url);
          continue;
        }
        let content: string | Blob = value;
        let contentType: string | undefined;
        if (value && typeof value === "object" && !(value instanceof Blob)) {
          content = value.content;
          contentType = value.contentType;
        }
        const blob =
          content instanceof Blob ? content : new Blob([String(content)], { type: contentType ?? "text/plain" });
        const r = await api.raw("PUT", url, blob, contentType ?? blob.type ?? "application/octet-stream");
        shas[path] = r.file.sha256;
      }
      return { version: this.o.artifact.currentVersionId ?? "", shas };
    }
    throw err("invalid_content", "publish takes an html string or a files map");
  }

  private async callAssets(method: string, args: any[]) {
    const slug = this.o.artifact.slug;
    const map = { forbidden: "not_granted" };
    try {
      if (method === "upload") {
        const blob: Blob = args[0];
        if (!(blob instanceof Blob) || blob.size === 0) throw err("invalid_request", "upload needs a non-empty Blob");
        const type = args[1]?.type ?? blob.type;
        return await api.raw("POST", artifactUrl(slug, "/assets"), blob, type || "application/octet-stream");
      }
      if (method === "list") return await api.get(artifactUrl(slug, "/assets"));
      if (method === "delete") {
        const id = String(args[0]).replace(/^\/_blob\//, "");
        return await api.delete(artifactUrl(slug, "/assets/" + encodeURIComponent(id)));
      }
    } catch (e) {
      if ((e as any)?.code && !(e instanceof ClientApiError)) throw e;
      throw toCapError(e, map);
    }
    throw err("capability_removed", `assets.${method} is not available`);
  }

  private callUser(method: string, args: any[]) {
    const v = this.o.viewer;
    switch (method) {
      case "id":
        return this.o.uid;
      case "canEdit":
        return this.atLeast("edit");
      case "isOwner":
        return this.o.level === "owner";
      case "can":
        if (args[0] === "data.write") return this.atLeast("interact");
        if (args[0] === "publish") return this.atLeast("edit");
        return this.atLeast("view");
      case "profile":
        return v ? { id: v.id, name: v.name, image: v.image ?? null } : null;
      case "profiles": {
        const ids: string[] = Array.isArray(args[0]) ? args[0] : [];
        return ids.map((id) => (v && id === v.id ? { id, name: v.name, image: v.image ?? null } : { id, name: null, image: null }));
      }
    }
    throw err("capability_removed", `user.${method} is not available`);
  }

  private callPermissions(method: string, args: any[]) {
    const all: Record<string, string> = {};
    for (const name of ["db", "room", "artifact", "assets", "downloads", "permissions", "user"]) {
      if (this.available(name)) all[name] = this.denied.has(name) ? "denied" : "granted";
    }
    if (method === "state") {
      return typeof args[0] === "string" ? (all[args[0]] ?? "unavailable") : all;
    }
    if (method === "request") {
      const names: string[] | undefined = Array.isArray(args[0]) ? args[0] : undefined;
      if (!names) return all;
      const out: Record<string, string> = {};
      for (const n of names) out[n] = all[n] ?? "unavailable";
      return out;
    }
    throw err("capability_removed", `permissions.${method} is not available`);
  }

  /* ---------------- subscriptions ---------------- */

  private async subscribe(id: number, ns: string, method: string, args: any[]) {
    if (!this.available(ns)) throw err("not_granted", `${ns} is not available in this view`);
    if (this.subs.size >= 64) throw err("resource_exhausted", "at most 64 subscriptions per view");
    const slug = this.o.artifact.slug;

    if (ns === "db" && (method === "doc" || method === "query")) {
      const isDoc = method === "doc";
      const path: string | null = isDoc ? args[0] : null;
      const spec = isDoc ? null : args[0];
      const collection: string = isDoc ? path!.split("/").slice(0, -1).join("/") : spec.collection;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let closed = false;
      const refetch = async () => {
        if (closed) return;
        try {
          const body = isDoc ? { op: "get", path } : { op: "query", ...spec };
          const r = await api.post(artifactUrl(slug, "/db"), body);
          if (!closed) this.event(id, "snapshot", r);
        } catch (e) {
          if (!closed) this.subError(id, toCapError(e, { forbidden: "invalid_argument", not_declared: "not_granted" }));
        }
      };
      const schedule = () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          refetch();
        }, 60);
      };
      const offDoc = this.o.realtime.on("doc", (d: { path: string; collection: string }) => {
        if (isDoc ? d.path === path : d.collection === collection) schedule();
      });
      const offConn = this.o.realtime.onConnection((c) => c && schedule());
      this.subs.set(id, {
        close: () => {
          closed = true;
          offDoc();
          offConn();
          if (timer) clearTimeout(timer);
        },
      });
      await refetch();
      return;
    }

    if (ns === "room" && method === "join") {
      this.ensureRoom();
      this.roomSubs.add(id);
      this.subs.set(id, {
        close: () => {
          this.roomSubs.delete(id);
        },
      });
      this.event(id, "hello", { me: { peer: this.peer, uid: this.o.uid } });
      this.event(id, "connection", { connected: this.o.realtime.connected });
      try {
        const r = await api.post(artifactUrl(slug, "/room"), { op: "peers" });
        this.event(id, "peers", r);
      } catch {
        /* first peers arrive with the next heartbeat */
      }
      return;
    }

    throw err("capability_removed", `${ns}.${method} is not subscribable`);
  }

  /* ---------------- room ---------------- */

  private ensureRoom() {
    if (this.roomJoined) return;
    this.roomJoined = true;
    const beat = () =>
      api.post(artifactUrl(this.o.artifact.slug, "/room"), { op: "heartbeat", peer: this.peer }).catch(() => {});
    beat();
    this.heartbeat = setInterval(beat, 10_000);
    window.addEventListener("pagehide", this.onPageHide, { once: true });
  }

  /* ---------------- downloads ---------------- */

  private async saveDownload(req: { filename?: unknown; data?: unknown }) {
    if (!req || typeof req.filename !== "string" || req.filename.length > 512) throw err("bad_request", "bad filename");
    const filename = req.filename.replace(INVISIBLE_RE, "").replace(/\s+/g, " ").trim().slice(0, 240);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    if (!filename.includes(".") || !DOWNLOAD_EXT.has(ext)) {
      throw err("rejected_extension", `"${ext}" is not an allowed extension`);
    }
    let blob: Blob;
    const d = req.data;
    if (typeof d === "string") blob = new Blob([d]);
    else if (d instanceof Blob) blob = d;
    else if (d instanceof ArrayBuffer || ArrayBuffer.isView(d)) blob = new Blob([d as BlobPart]);
    else throw err("bad_request", "data must be a string, Blob, ArrayBuffer or view");
    if (blob.size === 0) throw err("bad_request", "empty data");
    const ok = await this.o.confirmDownload({ filename, size: blob.size });
    if (!ok) throw err("declined", "The viewer declined");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { status: "saved" };
  }

}
