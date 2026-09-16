#!/usr/bin/env node
/**
 * artifacts — CLI for the self-hosted Artifacts platform.
 * Node 18+, no dependencies. Config: ARTIFACTS_URL / ARTIFACTS_TOKEN or
 * ~/.config/artifacts/config.json ({"url","token"}).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename, extname } from "node:path";

const CONFIG_DIR = join(homedir(), ".config", "artifacts");
const CONFIG = join(CONFIG_DIR, "config.json");

const TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf", ".csv": "text/csv",
  ".md": "text/markdown", ".json": "application/json", ".txt": "text/plain", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".html": "text/html", ".xml": "application/xml", ".wasm": "application/wasm", ".ico": "image/x-icon",
};

function loadConfig() {
  const env = { url: process.env.ARTIFACTS_URL, token: process.env.ARTIFACTS_TOKEN };
  if (env.url && env.token) return env;
  if (existsSync(CONFIG)) {
    const file = JSON.parse(readFileSync(CONFIG, "utf8"));
    return { url: env.url || file.url, token: env.token || file.token };
  }
  return env;
}

function die(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

/** Minimal arg parser: positionals + --flag value (repeatable) + --bool. */
function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        i++;
        if (flags[key] === undefined) flags[key] = next;
        else flags[key] = [].concat(flags[key], next);
      }
    } else pos.push(a);
  }
  return { pos, flags };
}

let cfg;
async function req(method, path, { json, body, contentType } = {}) {
  cfg = cfg || loadConfig();
  if (!cfg.url || !cfg.token) die("not configured — run: artifacts login --url <site> --token <token>");
  const headers = { authorization: `Bearer ${cfg.token}` };
  let payload;
  if (json !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(json);
  } else if (body !== undefined) {
    headers["content-type"] = contentType || "application/octet-stream";
    payload = body;
  }
  const res = await fetch(`${cfg.url.replace(/\/$/, "")}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    die(`${e.code ?? res.status}: ${e.message ?? text.slice(0, 200)}`);
  }
  return data;
}

const out = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
const enc = (s) => encodeURIComponent(s);
const filePath = (p) => p.split("/").map(enc).join("/");
const readArg = (v) => (typeof v === "string" && v.startsWith("@") ? readFileSync(v.slice(1), "utf8") : v);
const parseJsonArg = (v, what) => {
  try {
    return JSON.parse(readArg(v));
  } catch {
    die(`${what} must be JSON (inline or @file)`);
  }
};

const commands = {
  async login({ flags }) {
    if (!flags.url || !flags.token) die("usage: login --url <site> --token <token>");
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG, JSON.stringify({ url: String(flags.url).replace(/\/$/, ""), token: flags.token }, null, 2) + "\n", { mode: 0o600 });
    cfg = null;
    const me = await req("GET", "/api/v1/me");
    out(`Signed in as ${me.email} → ${CONFIG}`);
  },
  async config() {
    const c = loadConfig();
    out({ url: c.url ?? null, token: c.token ? c.token.slice(0, 10) + "…" : null, file: CONFIG });
  },
  async me() {
    out(await req("GET", "/api/v1/me"));
  },
  async list() {
    const r = await req("GET", "/api/v1/artifacts");
    const rows = [...r.owned, ...r.shared];
    if (!rows.length) return out("No artifacts yet.");
    for (const a of rows) out(`${a.slug.padEnd(28)} v${String(a.versionCount).padEnd(4)} ${a.level.padEnd(9)} link:${a.linkAccess.padEnd(9)} ${a.title}  ${a.url}`);
  },
  async publish({ pos, flags }) {
    const file = pos[0];
    if (!file) die("usage: publish <page.html> [--slug s] [--title t] [--description d] [--favicon e] [--capabilities json] [--link none|view|interact|edit] [--label l] [--file path=local ...]");
    const html = readFileSync(file, "utf8");
    const body = {
      html,
      title: flags.title,
      description: flags.description,
      favicon: flags.favicon,
      label: flags.label,
      capabilities: flags.capabilities !== undefined ? parseJsonArg(flags.capabilities, "--capabilities") : undefined,
      linkAccess: flags.link,
    };
    let artifact;
    let version;
    const slug = flags.slug;
    // Existence check via the listing (`req` exits the process on any error).
    const all = slug ? await req("GET", "/api/v1/artifacts") : { owned: [], shared: [] };
    const mine = slug ? [...all.owned, ...all.shared].find((a) => a.slug === slug) : null;
    if (mine) {
      const r = await req("PUT", `/api/v1/artifacts/${enc(slug)}`, { json: body });
      artifact = r.artifact;
      version = r.version;
    } else {
      const r = await req("POST", "/api/v1/artifacts", { json: { ...body, slug } });
      artifact = r.artifact;
      version = { number: 1 };
    }
    const files = [].concat(flags.file ?? []).filter(Boolean);
    for (const spec of files) {
      const [remote, local] = spec.includes("=") ? spec.split("=") : [basename(spec), spec];
      const data = readFileSync(local);
      await req("PUT", `/api/v1/artifacts/${enc(artifact.slug)}/files/${filePath(remote)}`, { body: data, contentType: TYPES[extname(local).toLowerCase()] });
      out(`file  ${remote}`);
    }
    out(`${mine ? "Updated" : "Published"} ${artifact.slug} (v${version?.number ?? "?"}) → ${artifact.url}`);
    if (artifact.linkAccess === "none") out("Link access: invited emails only. Use `share <slug> --link view` to open it.");
  },
  async get({ pos, flags }) {
    const slug = pos[0] || die("usage: get <slug> [--html out.html]");
    const r = await req("GET", `/api/v1/artifacts/${enc(slug)}${flags.html ? "" : "?html=0"}`);
    if (flags.html) {
      writeFileSync(String(flags.html), r.html ?? "");
      out(`Saved live HTML to ${flags.html}`);
    }
    const { html, ...rest } = r;
    void html;
    out(rest);
  },
  async delete({ pos }) {
    const slug = pos[0] || die("usage: delete <slug>");
    await req("DELETE", `/api/v1/artifacts/${enc(slug)}`);
    out(`Deleted ${slug}`);
  },
  async share({ pos, flags }) {
    const slug = pos[0] || die("usage: share <slug> [--link none|view|interact|edit] [--add email:role ...] [--remove email ...]");
    const body = {};
    if (flags.link) body.linkAccess = flags.link;
    const add = [].concat(flags.add ?? []).filter(Boolean);
    if (add.length) body.add = add.map((s) => { const [email, role = "view"] = s.split(":"); return { email, role }; });
    const remove = [].concat(flags.remove ?? []).filter(Boolean);
    if (remove.length) body.remove = remove;
    const r = Object.keys(body).length
      ? await req("PUT", `/api/v1/artifacts/${enc(slug)}/share`, { json: body })
      : await req("GET", `/api/v1/artifacts/${enc(slug)}/share`);
    out(r);
  },
  async versions({ pos }) {
    const slug = pos[0] || die("usage: versions <slug>");
    const r = await req("GET", `/api/v1/artifacts/${enc(slug)}/versions`);
    for (const v of r.versions) out(`${v.id}  v${String(v.number).padEnd(4)} ${v.id === r.current ? "live " : "     "} ${v.createdAt}  ${v.creatorName ?? ""}  ${v.label ?? ""}`);
  },
  async restore({ pos }) {
    const [slug, id] = pos;
    if (!slug || !id) die("usage: restore <slug> <versionId>");
    out(await req("POST", `/api/v1/artifacts/${enc(slug)}/versions/${enc(id)}/restore`, { json: {} }));
  },
  async db({ pos, flags }) {
    const [slug, op, a, b] = pos;
    if (!slug || !op) die("usage: db <slug> get|query|set|update|delete|acquire|batch …");
    const url = `/api/v1/artifacts/${enc(slug)}/db`;
    switch (op) {
      case "get":
        return out(await req("POST", url, { json: { op: "get", path: a } }));
      case "query": {
        const where = [].concat(flags.where ?? []).filter(Boolean);
        // --where is given as three tokens: field op value; re-join from argv.
        const filters = [];
        const argv = process.argv.slice(3);
        for (let i = 0; i < argv.length; i++) {
          if (argv[i] === "--where") {
            const [field, fop, raw] = argv.slice(i + 1, i + 4);
            let value;
            try { value = JSON.parse(raw); } catch { value = raw; }
            filters.push({ field, op: fop, value });
          }
        }
        void where;
        let orderBy = null;
        const oi = argv.indexOf("--order");
        if (oi >= 0) orderBy = { field: argv[oi + 1], dir: argv[oi + 2] === "desc" ? "desc" : "asc" };
        return out(await req("POST", url, { json: { op: "query", collection: a, filters, orderBy, limit: flags.limit ? Number(flags.limit) : null } }));
      }
      case "set":
        await req("POST", url, { json: { op: "set", path: a, data: parseJsonArg(b, "data") } });
        return out(`set ${a}`);
      case "update":
        await req("POST", url, { json: { op: "update", path: a, data: parseJsonArg(b, "data") } });
        return out(`updated ${a}`);
      case "delete":
        await req("POST", url, { json: { op: "delete", path: a } });
        return out(`deleted ${a}`);
      case "acquire":
        return out(await req("POST", url, { json: { op: "acquire", path: a, holder: flags.holder ?? "cli", ttlMs: flags.ttl ? Number(flags.ttl) : undefined } }));
      case "batch":
        return out(await req("POST", url, { json: { op: "batch", ops: parseJsonArg(a, "ops") } }));
      default:
        die(`unknown db op ${op}`);
    }
  },
  async comments({ pos }) {
    const slug = pos[0] || die("usage: comments <slug>");
    const r = await req("GET", `/api/v1/artifacts/${enc(slug)}/comments`);
    if (!r.comments.length) return out("No comments.");
    for (const c of r.comments) out(`${c.id}  ${c.parentId ? "  ↳ " : ""}${c.resolved ? "[resolved] " : ""}${c.authorName} (${c.createdAt}): ${c.body}`);
  },
  async comment({ pos, flags }) {
    const [slug, body] = pos;
    if (!slug || !body) die('usage: comment <slug> "text" [--reply <commentId>]');
    out(await req("POST", `/api/v1/artifacts/${enc(slug)}/comments`, { json: { body, parentId: flags.reply ?? null } }));
  },
  async resolve({ pos, flags }) {
    const [slug, id] = pos;
    if (!slug || !id) die("usage: resolve <slug> <commentId> [--reopen]");
    await req("PATCH", `/api/v1/artifacts/${enc(slug)}/comments/${enc(id)}`, { json: { resolved: !flags.reopen } });
    out(flags.reopen ? "reopened" : "resolved");
  },
  async assets({ pos }) {
    const slug = pos[0] || die("usage: assets <slug>");
    out(await req("GET", `/api/v1/artifacts/${enc(slug)}/assets`));
  },
  async upload({ pos, flags }) {
    const [slug, local] = pos;
    if (!slug || !local) die("usage: upload <slug> <file> [--type mime]");
    const type = flags.type || TYPES[extname(local).toLowerCase()] || die("cannot infer --type");
    const r = await req("POST", `/api/v1/artifacts/${enc(slug)}/assets`, { body: readFileSync(local), contentType: type });
    out(`${r.id}  ${r.url}  ${r.contentType} ${r.sizeBytes}B`);
  },
  async files({ pos }) {
    const slug = pos[0] || die("usage: files <slug>");
    const r = await req("GET", `/api/v1/artifacts/${enc(slug)}/files`);
    if (!r.files.length) return out("No files.");
    for (const f of r.files) out(`${f.path.padEnd(40)} ${f.contentType.padEnd(24)} ${f.size}B`);
  },
  async file({ pos, flags }) {
    const [sub, slug, remote, local] = pos;
    if (sub === "put") {
      if (!slug || !remote || !local) die("usage: file put <slug> <remotePath> <localFile>");
      const r = await req("PUT", `/api/v1/artifacts/${enc(slug)}/files/${filePath(remote)}`, { body: readFileSync(local), contentType: flags.type || TYPES[extname(local).toLowerCase()] });
      return out(r.file);
    }
    if (sub === "rm") {
      if (!slug || !remote) die("usage: file rm <slug> <remotePath>");
      await req("DELETE", `/api/v1/artifacts/${enc(slug)}/files/${filePath(remote)}`);
      return out(`removed ${remote}`);
    }
    die("usage: file put|rm …");
  },
  async help() {
    out(`artifacts <command>

  login --url <site> --token <token>     save credentials
  me | config | list
  publish <page.html> [--slug s] [--title t] [--description d] [--favicon e]
          [--capabilities '{"db":{}}'] [--link none|view|interact|edit] [--label l] [--file remote=local]
  get <slug> [--html out.html] | delete <slug>
  share <slug> [--link L] [--add email:role] [--remove email]
  versions <slug> | restore <slug> <versionId>
  db <slug> get <path> | query <collection> [--where f op v] [--order f asc|desc] [--limit n]
            | set <path> <json|@file> | update <path> <json> | delete <path> | acquire <path> | batch @ops.json
  comments <slug> | comment <slug> "text" [--reply id] | resolve <slug> <id> [--reopen]
  assets <slug> | upload <slug> <file> [--type mime]
  files <slug> | file put <slug> <remote> <local> | file rm <slug> <remote>`);
  },
};

const [cmd, ...rest] = process.argv.slice(2);
const fn = commands[cmd] ?? commands.help;
fn(parseArgs(rest)).catch((e) => die(e?.message ?? String(e)));
