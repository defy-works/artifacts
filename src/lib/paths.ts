/**
 * Document-path grammar shared by the server and the injected runtime.
 * Mirrors the `db` contract: even segment count = document, odd =
 * collection; segments use `[A-Za-z0-9_\-.~:@+]`, never `.`/`..`;
 * ≤200 bytes per segment, ≤1000 bytes and ≤16 segments per path.
 */
const SEGMENT_RE = /^[A-Za-z0-9_\-.~:@+]+$/;

export function splitPath(path: string): string[] {
  if (typeof path !== "string") throw new TypeError("path must be a string");
  const trimmed = path.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return [];
  return trimmed.split("/");
}

export function validateSegments(segs: string[]): void {
  if (segs.length === 0) throw new TypeError("path is empty");
  if (segs.length > 16) throw new TypeError("path has more than 16 segments");
  let bytes = 0;
  for (const s of segs) {
    if (s === "." || s === "..") throw new TypeError(`invalid segment "${s}"`);
    if (!SEGMENT_RE.test(s)) throw new TypeError(`invalid characters in segment "${s}"`);
    const b = new TextEncoder().encode(s).length;
    if (b > 200) throw new TypeError("segment exceeds 200 bytes");
    bytes += b + 1;
  }
  if (bytes > 1001) throw new TypeError("path exceeds 1000 bytes");
}

export function parseDocPath(path: string) {
  const segs = splitPath(path);
  validateSegments(segs);
  if (segs.length % 2 !== 0) {
    throw new TypeError(
      `document path must have an even number of segments (got ${segs.length})`,
    );
  }
  return {
    path: segs.join("/"),
    collection: segs.slice(0, -1).join("/"),
    id: segs[segs.length - 1],
    segments: segs,
  };
}

export function parseCollectionPath(path: string) {
  const segs = splitPath(path);
  validateSegments(segs);
  if (segs.length % 2 !== 1) {
    throw new TypeError(
      `collection path must have an odd number of segments (got ${segs.length})`,
    );
  }
  return { path: segs.join("/"), segments: segs };
}

export const MAX_DOC_BYTES = 256 * 1024;
export const MAX_DOC_DEPTH = 32;
export const MAX_DOCS_PER_ARTIFACT = 5000;

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function jsonDepth(v: unknown, d = 1): number {
  if (typeof v !== "object" || v === null) return d;
  let max = d;
  for (const k of Object.keys(v as object)) {
    max = Math.max(max, jsonDepth((v as Record<string, unknown>)[k], d + 1));
  }
  return max;
}
