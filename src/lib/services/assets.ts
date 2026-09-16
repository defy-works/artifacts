import { and, desc, eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Artifact } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { hexId } from "@/lib/ids";

export const ASSET_TYPES = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "video/mp4", "video/webm",
  "application/pdf", "font/woff2", "font/woff", "font/ttf", "font/otf", "text/csv", "text/markdown",
  "application/json", "text/plain", "text/css", "text/javascript",
]);
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_ASSET_FILES = 500;
export const MAX_ASSET_TOTAL = 512 * 1024 * 1024;

function limitFor(type: string) {
  if (type === "image/svg+xml") return 2 * 1024 * 1024;
  if (type === "text/css" || type === "text/javascript") return 16 * 1024 * 1024;
  return MAX_ASSET_BYTES;
}

/** Strip scripts, handlers, external refs from an SVG (best-effort). */
function sanitizeSvg(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<(animate|animateTransform|animateMotion|set)\b[\s\S]*?(\/>|<\/\1>)/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|"data:[^"]*"|'data:[^']*')/gi, "")
    .replace(/xlink:href\s*=\s*("https?:[^"]*"|'https?:[^']*')/gi, "");
}

export async function uploadAsset(artifact: Artifact, by: string, data: Uint8Array, rawType: string | null) {
  const type = (rawType ?? "").split(";")[0].trim().toLowerCase();
  if (!ASSET_TYPES.has(type)) throw new ApiError(415, "unsupported_type", `Unsupported content type "${type}"`);
  if (data.byteLength === 0) throw new ApiError(400, "invalid_request", "empty upload");
  let bytes = data;
  if (type === "image/svg+xml") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(data);
    if (!/<svg[\s>]/i.test(text)) throw new ApiError(415, "unsupported_type", "not an SVG document");
    bytes = new TextEncoder().encode(sanitizeSvg(text));
  } else if (type.startsWith("text/") || type === "application/json") {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      throw new ApiError(400, "invalid_request", "text asset is not valid UTF-8");
    }
    if ((type === "text/css" || type === "text/javascript") && /^\s*</.test(new TextDecoder().decode(data.slice(0, 64)))) {
      throw new ApiError(415, "unsupported_type", "stylesheet or script starts with markup");
    }
  } else if (/^\s*</.test(new TextDecoder("utf-8", { fatal: false }).decode(data.slice(0, 64)))) {
    throw new ApiError(415, "unsupported_type", "binary type starts with markup");
  }
  if (bytes.byteLength > limitFor(type)) throw new ApiError(413, "too_large", "asset exceeds the per-file limit");
  const usage = await getUsage(artifact.id);
  if (usage.files >= MAX_ASSET_FILES || usage.bytes + bytes.byteLength > MAX_ASSET_TOTAL) {
    throw new ApiError(429, "quota_or_state", "asset quota exhausted");
  }
  const id = hexId();
  await db.insert(schema.assets).values({
    id,
    artifactId: artifact.id,
    contentType: type,
    sizeBytes: bytes.byteLength,
    data: bytes,
    createdBy: by,
  });
  return { id, url: `/_blob/${id}`, sizeBytes: bytes.byteLength, contentType: type };
}

export async function getUsage(artifactId: string) {
  const [row] = await db
    .select({
      files: dsql<number>`count(*)::int`,
      bytes: dsql<number>`coalesce(sum(${schema.assets.sizeBytes}), 0)::bigint`,
    })
    .from(schema.assets)
    .where(eq(schema.assets.artifactId, artifactId));
  return { files: Number(row?.files ?? 0), bytes: Number(row?.bytes ?? 0), maxFiles: MAX_ASSET_FILES, maxBytes: MAX_ASSET_TOTAL };
}

export async function listAssets(artifactId: string) {
  const rows = await db
    .select({
      id: schema.assets.id,
      contentType: schema.assets.contentType,
      sizeBytes: schema.assets.sizeBytes,
      createdAt: schema.assets.createdAt,
    })
    .from(schema.assets)
    .where(eq(schema.assets.artifactId, artifactId))
    .orderBy(desc(schema.assets.createdAt));
  return {
    assets: rows.reverse().map((r) => ({ ...r, url: `/_blob/${r.id}`, createdAt: r.createdAt.toISOString() })),
    usage: await getUsage(artifactId),
  };
}

export async function deleteAsset(artifactId: string, ref: string) {
  const id = ref.replace(/^\/_blob\//, "");
  const gone = await db
    .delete(schema.assets)
    .where(and(eq(schema.assets.artifactId, artifactId), eq(schema.assets.id, id)))
    .returning({ id: schema.assets.id });
  return { deleted: gone.length > 0 };
}

export async function getAsset(id: string) {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  return db.query.assets.findFirst({ where: eq(schema.assets.id, id) });
}
