import { and, desc, eq, inArray, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Artifact, LinkAccess } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { hexId, shortId, slugify } from "@/lib/ids";
import { sha256Hex } from "@/lib/hash";
import { publish } from "@/lib/realtime";
import type { Viewer } from "@/lib/access";

export const MAX_HTML_BYTES = 16 * 1024 * 1024;
export const MAX_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_FILES = 255;

const KNOWN_CAPS = new Set(["db", "room", "artifact", "self", "assets", "downloads"]);
const LINK_LEVELS = new Set(["none", "view", "interact", "edit"]);

export function normalizeCapabilities(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "invalid_argument", "capabilities must be an object");
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!KNOWN_CAPS.has(k)) throw new ApiError(400, "invalid_argument", `Unknown capability "${k}"`);
    if (v === false || v === null || v === undefined) continue;
    const key = k === "self" ? "artifact" : k;
    out[key] = v === true ? {} : v;
  }
  return out;
}

export function assertLinkAccess(v: unknown): LinkAccess {
  if (typeof v !== "string" || !LINK_LEVELS.has(v)) {
    throw new ApiError(400, "invalid_argument", "linkAccess must be none|view|interact|edit");
  }
  return v as LinkAccess;
}

function assertHtml(html: unknown): string {
  if (typeof html !== "string") throw new ApiError(400, "invalid_content", "html must be a string");
  if (!/^\s*<!doctype html/i.test(html)) {
    throw new ApiError(400, "invalid_content", "html must start with <!doctype html>");
  }
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) throw new ApiError(413, "too_large", "html exceeds 16 MiB");
  return html;
}

export function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, " ").trim();
  return t.length ? t.slice(0, 120) : null;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "artifact";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${shortId(4)}`;
    const exists = await db.query.artifacts.findFirst({
      where: eq(schema.artifacts.slug, candidate),
      columns: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${root}-${shortId(8)}`;
}

export interface CreateInput {
  slug?: string;
  title?: string;
  description?: string;
  favicon?: string;
  html: string;
  capabilities?: unknown;
  linkAccess?: unknown;
  label?: string;
}

export async function createArtifact(owner: Viewer, input: CreateInput) {
  const html = assertHtml(input.html);
  const title = (input.title?.trim() || extractTitle(html) || "Untitled").slice(0, 120);
  const slug = input.slug ? await uniqueSlug(input.slug) : await uniqueSlug(title);
  const capabilities = normalizeCapabilities(input.capabilities);
  const linkAccess = input.linkAccess === undefined ? "none" : assertLinkAccess(input.linkAccess);
  const id = shortId(16);
  const now = new Date();
  const artifact = await db.transaction(async (tx) => {
    const [a] = await tx
      .insert(schema.artifacts)
      .values({
        id,
        slug,
        title,
        description: input.description?.slice(0, 1000) ?? null,
        favicon: input.favicon?.slice(0, 32) ?? null,
        ownerId: owner.id,
        capabilities,
        linkAccess,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const v = await insertVersion(tx, a, html, owner.id, input.label);
    return { ...a, currentVersionId: v.id, versionCount: 1 };
  });
  return artifact;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function insertVersion(tx: Tx, artifact: Artifact, html: string, by: string, label?: string) {
  const number = artifact.versionCount + 1;
  const id = shortId(16);
  const [v] = await tx
    .insert(schema.versions)
    .values({
      id,
      artifactId: artifact.id,
      number,
      label: label?.slice(0, 60) ?? null,
      html,
      size: Buffer.byteLength(html, "utf8"),
      sha256: sha256Hex(html),
      createdBy: by,
    })
    .returning();
  await tx
    .update(schema.artifacts)
    .set({ currentVersionId: id, versionCount: number, updatedAt: new Date() })
    .where(eq(schema.artifacts.id, artifact.id));
  return v;
}

export interface UpdateInput {
  title?: string;
  description?: string | null;
  favicon?: string | null;
  html?: string;
  capabilities?: unknown;
  linkAccess?: unknown;
  label?: string;
  /** Compare-and-set: publish only if this is still the live version id. */
  ifVersion?: string;
}

/** Update metadata and/or publish a new version. Returns the fresh row. */
export async function updateArtifact(artifact: Artifact, by: Viewer, input: UpdateInput, level: "edit" | "owner") {
  const patch: Partial<Artifact> = {};
  if (input.title !== undefined) patch.title = String(input.title).trim().slice(0, 120) || artifact.title;
  if (input.description !== undefined) patch.description = input.description ? String(input.description).slice(0, 1000) : null;
  if (input.favicon !== undefined) patch.favicon = input.favicon ? String(input.favicon).slice(0, 32) : null;
  if (input.capabilities !== undefined) patch.capabilities = normalizeCapabilities(input.capabilities);
  if (input.linkAccess !== undefined) {
    if (level !== "owner") throw new ApiError(403, "forbidden", "Only the owner changes link access");
    patch.linkAccess = assertLinkAccess(input.linkAccess);
  }
  const html = input.html !== undefined ? assertHtml(input.html) : null;

  const result = await db.transaction(async (tx) => {
    const [fresh] = await tx
      .select()
      .from(schema.artifacts)
      .where(eq(schema.artifacts.id, artifact.id))
      .for("update");
    if (!fresh) throw new ApiError(404, "not_found");
    if (html !== null && input.ifVersion && fresh.currentVersionId !== input.ifVersion) {
      throw new ApiError(409, "conflict", "A newer version was published first");
    }
    let version: schema.Version | null = null;
    if (html !== null) version = await insertVersion(tx, fresh, html, by.id, input.label);
    if (Object.keys(patch).length) {
      await tx
        .update(schema.artifacts)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(schema.artifacts.id, artifact.id));
    }
    const [updated] = await tx.select().from(schema.artifacts).where(eq(schema.artifacts.id, artifact.id));
    return { artifact: updated, version };
  });
  if (result.version) {
    publish(artifact.id, { type: "version", versionId: result.version.id, number: result.version.number });
  }
  if (Object.keys(patch).length) publish(artifact.id, { type: "meta" });
  return result;
}

export async function deleteArtifact(artifact: Artifact) {
  await db.delete(schema.artifacts).where(eq(schema.artifacts.id, artifact.id));
  publish(artifact.id, { type: "deleted" });
}

export async function getVersion(artifact: Artifact, versionId?: string | null) {
  const id = versionId ?? artifact.currentVersionId;
  if (!id) return null;
  return db.query.versions.findFirst({ where: eq(schema.versions.id, id) });
}

export async function listVersions(artifactId: string) {
  return db
    .select({
      id: schema.versions.id,
      number: schema.versions.number,
      label: schema.versions.label,
      size: schema.versions.size,
      sha256: schema.versions.sha256,
      createdBy: schema.versions.createdBy,
      createdAt: schema.versions.createdAt,
      creatorName: schema.user.name,
    })
    .from(schema.versions)
    .leftJoin(schema.user, eq(schema.user.id, schema.versions.createdBy))
    .where(eq(schema.versions.artifactId, artifactId))
    .orderBy(desc(schema.versions.number));
}

/** Gallery listing: owned + shared-by-email, newest first. */
export async function listForViewer(viewer: Viewer) {
  const owned = await db
    .select()
    .from(schema.artifacts)
    .where(eq(schema.artifacts.ownerId, viewer.id))
    .orderBy(desc(schema.artifacts.updatedAt));
  const shareRows = await db
    .select({ artifactId: schema.shares.artifactId, role: schema.shares.role })
    .from(schema.shares)
    .where(eq(schema.shares.email, viewer.email.toLowerCase()));
  const ids = shareRows.map((s) => s.artifactId);
  const shared = ids.length
    ? await db
        .select({
          artifact: schema.artifacts,
          ownerName: schema.user.name,
        })
        .from(schema.artifacts)
        .leftJoin(schema.user, eq(schema.user.id, schema.artifacts.ownerId))
        .where(inArray(schema.artifacts.id, ids))
        .orderBy(desc(schema.artifacts.updatedAt))
    : [];
  const roleById = new Map(shareRows.map((s) => [s.artifactId, s.role]));
  return {
    owned: owned.map((a) => summarize(a, "owner", viewer.name)),
    shared: shared.map(({ artifact, ownerName }) =>
      summarize(artifact, roleById.get(artifact.id) ?? "view", ownerName ?? "Someone"),
    ),
  };
}

export function summarize(a: Artifact, level: string, ownerName: string) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    favicon: a.favicon,
    capabilities: a.capabilities,
    linkAccess: a.linkAccess,
    versionCount: a.versionCount,
    updatedAt: a.updatedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    level,
    ownerName,
    url: `${siteUrl()}/a/${a.slug}`,
  };
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/* ---------- supporting files ---------- */

const EXT_TYPES: Record<string, string> = {
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript",
  json: "application/json", webmanifest: "application/manifest+json", txt: "text/plain", md: "text/markdown",
  xml: "application/xml", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", woff: "font/woff",
  woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp3: "audio/mpeg", wav: "audio/wav",
  mp4: "video/mp4", webm: "video/webm", pdf: "application/pdf", wasm: "application/wasm", csv: "text/csv",
};

export function contentTypeForPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? null;
}

export function normalizeFilePath(path: string): string {
  const p = path.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!p || p.length > 512 || p.split("/").some((s) => s === "" || s === "." || s === "..")) {
    throw new ApiError(400, "invalid_argument", `Invalid file path "${path}"`);
  }
  if (p === "index.html") throw new ApiError(400, "invalid_argument", "index.html is the page itself");
  return p;
}

export async function putFile(artifact: Artifact, path: string, data: Uint8Array, contentType?: string | null) {
  const p = normalizeFilePath(path);
  const type = contentType?.split(";")[0].trim() || contentTypeForPath(p);
  if (!type) throw new ApiError(400, "invalid_argument", `Cannot infer content type for "${p}"`);
  if (data.byteLength > MAX_FILE_BYTES) throw new ApiError(413, "too_large", "file exceeds 16 MiB");
  const count = await db.$count(schema.files, eq(schema.files.artifactId, artifact.id));
  if (count >= MAX_FILES) throw new ApiError(413, "too_large", `at most ${MAX_FILES} files`);
  const sha256 = sha256Hex(data);
  await db
    .insert(schema.files)
    .values({ artifactId: artifact.id, path: p, contentType: type, size: data.byteLength, sha256, data })
    .onConflictDoUpdate({
      target: [schema.files.artifactId, schema.files.path],
      set: { contentType: type, size: data.byteLength, sha256, data, updatedAt: new Date() },
    });
  publish(artifact.id, { type: "meta" });
  return { path: p, contentType: type, size: data.byteLength, sha256 };
}

export async function deleteFile(artifact: Artifact, path: string) {
  const p = normalizeFilePath(path);
  await db.delete(schema.files).where(and(eq(schema.files.artifactId, artifact.id), eq(schema.files.path, p)));
  publish(artifact.id, { type: "meta" });
}

export async function listFiles(artifactId: string) {
  return db
    .select({
      path: schema.files.path,
      contentType: schema.files.contentType,
      size: schema.files.size,
      sha256: schema.files.sha256,
      updatedAt: schema.files.updatedAt,
    })
    .from(schema.files)
    .where(eq(schema.files.artifactId, artifactId))
    .orderBy(schema.files.path);
}

export async function getFile(artifactId: string, path: string) {
  return db.query.files.findFirst({
    where: and(eq(schema.files.artifactId, artifactId), eq(schema.files.path, path)),
  });
}

export async function hasFiles(artifactId: string) {
  const n = await db.$count(schema.files, eq(schema.files.artifactId, artifactId));
  return n > 0;
}

export { hexId, dsql };
