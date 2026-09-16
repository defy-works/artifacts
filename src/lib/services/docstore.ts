/**
 * The `db` capability's store. Every entry point takes the caller's level
 * and uid and enforces the artifact's declared rules, so the HTTP layer
 * and the skill API share one implementation.
 */
import { and, eq, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Artifact } from "@/db/schema";
import { ApiError } from "@/lib/http";
import {
  isPlainObject,
  jsonDepth,
  MAX_DOC_BYTES,
  MAX_DOC_DEPTH,
  MAX_DOCS_PER_ARTIFACT,
  parseCollectionPath,
  parseDocPath,
} from "@/lib/paths";
import { canRead, canWrite, parseRules, type Level } from "@/lib/rules";
import { matches, sortDocs, validateFilters, type Filter, type OrderBy } from "@/lib/filters";
import { publish } from "@/lib/realtime";

export interface Actor {
  uid: string | null;
  level: Level;
}

export interface Snapshot {
  id: string;
  path: string;
  exists: boolean;
  data?: Record<string, unknown>;
  version?: number;
  updatedAt?: string;
}

function snap(row: schema.Doc | undefined, path: string, id: string): Snapshot {
  if (!row) return { id, path, exists: false };
  return {
    id,
    path,
    exists: true,
    data: row.data,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertBody(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) throw new ApiError(400, "invalid_argument", "document body must be a plain object");
  const bytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  if (bytes > MAX_DOC_BYTES) throw new ApiError(400, "invalid_argument", "document exceeds 256 KiB");
  if (jsonDepth(data) > MAX_DOC_DEPTH) throw new ApiError(400, "invalid_argument", "document nests deeper than 32 levels");
  return data;
}

function rulesOf(artifact: Artifact) {
  if (!artifact.capabilities || !("db" in artifact.capabilities)) {
    throw new ApiError(400, "not_declared", "This artifact does not declare the db capability");
  }
  return parseRules(artifact.capabilities);
}

export async function getDoc(artifact: Artifact, actor: Actor, rawPath: string): Promise<Snapshot> {
  const rules = rulesOf(artifact);
  const { path, id } = parseDocPath(rawPath);
  if (!canRead(rules, path, actor.uid, actor.level)) return { id, path, exists: false };
  const row = await db.query.docs.findFirst({
    where: and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)),
  });
  return snap(row, path, id);
}

export interface QueryInput {
  collection: string;
  filters?: Filter[];
  orderBy?: OrderBy | null;
  limit?: number | null;
}

export async function queryCollection(artifact: Artifact, actor: Actor, q: QueryInput) {
  const rules = rulesOf(artifact);
  const { path: collection } = parseCollectionPath(q.collection);
  const filters = q.filters ?? [];
  validateFilters(filters);
  const limit = q.limit == null ? 1000 : Math.max(1, Math.min(1000, Math.floor(q.limit)));
  const rows = await db.query.docs.findMany({
    where: and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.collection, collection)),
  });
  const visible = rows.filter(
    (r) => canRead(rules, r.path, actor.uid, actor.level) && filters.every((f) => matches(r.data, f)),
  );
  const ordered = sortDocs(visible, q.orderBy ?? null).slice(0, limit);
  return {
    docs: ordered.map((r) => snap(r, r.path, r.docId)),
  };
}

async function requireWrite(artifact: Artifact, actor: Actor, rawPath: string) {
  const rules = rulesOf(artifact);
  const parsed = parseDocPath(rawPath);
  if (!canWrite(rules, parsed.path, actor.uid, actor.level)) {
    throw new ApiError(400, "invalid_argument", "This viewer cannot write that path");
  }
  return parsed;
}

export async function setDoc(artifact: Artifact, actor: Actor, rawPath: string, data: unknown) {
  const { path, collection, id } = await requireWrite(artifact, actor, rawPath);
  const body = assertBody(data);
  await db.transaction(async (tx) => {
    const existing = await tx.query.docs.findFirst({
      where: and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)),
      columns: { version: true },
    });
    if (!existing) {
      const [a] = await tx
        .select({ docCount: schema.artifacts.docCount })
        .from(schema.artifacts)
        .where(eq(schema.artifacts.id, artifact.id))
        .for("update");
      if ((a?.docCount ?? 0) >= MAX_DOCS_PER_ARTIFACT) {
        throw new ApiError(429, "quota_exceeded", `This artifact's database holds at most ${MAX_DOCS_PER_ARTIFACT} documents`);
      }
      await tx.insert(schema.docs).values({
        artifactId: artifact.id,
        path,
        collection,
        docId: id,
        data: body,
        updatedBy: actor.uid,
      });
      await tx
        .update(schema.artifacts)
        .set({ docCount: dsql`${schema.artifacts.docCount} + 1` })
        .where(eq(schema.artifacts.id, artifact.id));
    } else {
      await tx
        .update(schema.docs)
        .set({ data: body, updatedBy: actor.uid, updatedAt: new Date(), version: existing.version + 1 })
        .where(and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)));
    }
  });
  publish(artifact.id, { type: "doc", path, collection });
}

function deepMerge(target: Record<string, unknown>, patch: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function updateDoc(artifact: Artifact, actor: Actor, rawPath: string, patch: unknown) {
  const { path, collection } = await requireWrite(artifact, actor, rawPath);
  if (!isPlainObject(patch)) throw new ApiError(400, "invalid_argument", "patch must be a plain object");
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.docs)
      .where(and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)))
      .for("update");
    if (!existing) throw new ApiError(400, "invalid_argument", "update requires the document to exist");
    const merged = assertBody(deepMerge(existing.data, patch));
    await tx
      .update(schema.docs)
      .set({ data: merged, updatedBy: actor.uid, updatedAt: new Date(), version: existing.version + 1 })
      .where(and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)));
  });
  publish(artifact.id, { type: "doc", path, collection });
}

export async function deleteDoc(artifact: Artifact, actor: Actor, rawPath: string) {
  const { path, collection } = await requireWrite(artifact, actor, rawPath);
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(schema.docs)
      .where(and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)))
      .returning({ path: schema.docs.path });
    if (deleted.length) {
      await tx
        .update(schema.artifacts)
        .set({ docCount: dsql`GREATEST(${schema.artifacts.docCount} - 1, 0)` })
        .where(eq(schema.artifacts.id, artifact.id));
    }
  });
  publish(artifact.id, { type: "doc", path, collection, deleted: true });
}

export interface AcquireInput {
  holder: string;
  ttlMs?: number;
  data?: Record<string, unknown>;
}

export async function acquireLease(artifact: Artifact, actor: Actor, rawPath: string, opts: AcquireInput) {
  const { path, collection, id } = await requireWrite(artifact, actor, rawPath);
  if (typeof opts.holder !== "string" || !opts.holder) {
    throw new ApiError(400, "invalid_argument", "holder must be a non-empty string");
  }
  const ttl = Math.max(1000, Math.min(600_000, opts.ttlMs || 30_000));
  const now = Date.now();
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.docs)
      .where(and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)))
      .for("update");
    const busy =
      existing?.leaseHolder &&
      existing.leaseExpiresAt &&
      existing.leaseExpiresAt.getTime() > now &&
      existing.leaseHolder !== opts.holder;
    if (busy) {
      return { acquired: false, expiresAt: existing!.leaseExpiresAt!.toISOString() };
    }
    const expiresAt = new Date(now + ttl);
    const data = opts.data ? assertBody(deepMerge(existing?.data ?? {}, opts.data)) : (existing?.data ?? {});
    if (!existing) {
      await tx.insert(schema.docs).values({
        artifactId: artifact.id,
        path,
        collection,
        docId: id,
        data,
        updatedBy: actor.uid,
        leaseHolder: opts.holder,
        leaseExpiresAt: expiresAt,
      });
      await tx
        .update(schema.artifacts)
        .set({ docCount: dsql`${schema.artifacts.docCount} + 1` })
        .where(eq(schema.artifacts.id, artifact.id));
      return { acquired: true, version: 1, expiresAt: expiresAt.toISOString(), holder: opts.holder };
    }
    const version = opts.data ? existing.version + 1 : existing.version;
    await tx
      .update(schema.docs)
      .set({ data, leaseHolder: opts.holder, leaseExpiresAt: expiresAt, version, updatedAt: new Date() })
      .where(and(eq(schema.docs.artifactId, artifact.id), eq(schema.docs.path, path)));
    return { acquired: true, version, expiresAt: expiresAt.toISOString(), holder: opts.holder };
  });
  if (result.acquired) publish(artifact.id, { type: "doc", path, collection });
  return result;
}

/** Whole-collection dump for the skill's `list` op (owner-level tooling). */
export async function listCollection(artifact: Artifact, actor: Actor, collection: string) {
  return queryCollection(artifact, actor, { collection });
}
