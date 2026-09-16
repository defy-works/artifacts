import { and, eq, gt, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Artifact } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { LEVEL_RANK, topicMinRank, type Level } from "@/lib/rules";
import { publish } from "@/lib/realtime";
import { isPlainObject, jsonDepth } from "@/lib/paths";

export const PRESENCE_TTL_MS = 30_000;
const TOPIC_RE = /^[a-z][a-z0-9_.-]{0,47}$/;
const PEER_RE = /^[a-z0-9]{8,32}$/;

function requireRoom(artifact: Artifact) {
  if (!artifact.capabilities || !("room" in artifact.capabilities)) {
    throw new ApiError(400, "not_declared", "This artifact does not declare the room capability");
  }
}

function assertPeer(peer: unknown): string {
  if (typeof peer !== "string" || !PEER_RE.test(peer)) throw new ApiError(400, "invalid_argument", "bad peer id");
  return peer;
}

function jsonBytes(v: unknown) {
  return Buffer.byteLength(JSON.stringify(v ?? null), "utf8");
}

export async function heartbeat(artifact: Artifact, uid: string | null, peer: unknown, patch?: unknown) {
  requireRoom(artifact);
  const p = assertPeer(peer);
  const now = new Date();
  const existing = await db.query.presence.findFirst({
    where: and(eq(schema.presence.artifactId, artifact.id), eq(schema.presence.peer, p)),
  });
  let data = existing?.data ?? {};
  let changed = !existing;
  if (patch !== undefined) {
    if (!isPlainObject(patch)) throw new ApiError(400, "invalid_argument", "presence patch must be an object");
    const next: Record<string, unknown> = { ...data };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    if (jsonBytes(next) > 4096 || jsonDepth(next) > 8) {
      throw new ApiError(400, "invalid_argument", "presence exceeds 4 KiB or nests deeper than 8");
    }
    if (JSON.stringify(next) !== JSON.stringify(data)) {
      data = next;
      changed = true;
    }
  }
  await db
    .insert(schema.presence)
    .values({ artifactId: artifact.id, peer: p, uid, data, updatedAt: now, lastSeen: now })
    .onConflictDoUpdate({
      target: [schema.presence.artifactId, schema.presence.peer],
      set: changed ? { data, updatedAt: now, lastSeen: now, uid } : { lastSeen: now },
    });
  // Opportunistic sweep of stale rows so the peers list stays honest.
  const stale = await db
    .delete(schema.presence)
    .where(and(eq(schema.presence.artifactId, artifact.id), lt(schema.presence.lastSeen, new Date(Date.now() - PRESENCE_TTL_MS))))
    .returning({ peer: schema.presence.peer });
  if (changed || stale.length) publish(artifact.id, { type: "presence" });
}

export async function leave(artifact: Artifact, peer: unknown) {
  const p = assertPeer(peer);
  const gone = await db
    .delete(schema.presence)
    .where(and(eq(schema.presence.artifactId, artifact.id), eq(schema.presence.peer, p)))
    .returning({ peer: schema.presence.peer });
  if (gone.length) publish(artifact.id, { type: "presence" });
}

export async function listPeers(artifact: Artifact) {
  const rows = await db.query.presence.findMany({
    where: and(eq(schema.presence.artifactId, artifact.id), gt(schema.presence.lastSeen, new Date(Date.now() - PRESENCE_TTL_MS))),
  });
  return rows.map((r) => ({
    peer: r.peer,
    by: r.uid,
    presence: r.data,
    updatedAt: r.updatedAt.getTime(),
  }));
}

export async function emit(artifact: Artifact, uid: string | null, level: Level, peer: unknown, topic: unknown, data: unknown) {
  requireRoom(artifact);
  const p = assertPeer(peer);
  if (typeof topic !== "string" || !TOPIC_RE.test(topic)) throw new ApiError(400, "invalid_argument", "bad topic");
  if (data !== undefined && jsonBytes(data) > 4096) throw new ApiError(400, "invalid_argument", "data exceeds 4 KiB");
  if (LEVEL_RANK[level] < topicMinRank(artifact.capabilities, topic)) {
    throw new ApiError(403, "not_permitted", `This viewer may not send on "${topic}"`);
  }
  const [row] = await db
    .insert(schema.roomEvents)
    .values({ artifactId: artifact.id, topic, data: data ?? null, peer: p, uid })
    .returning({ id: schema.roomEvents.id });
  publish(artifact.id, { type: "room", id: row.id });
  // Prune old events opportunistically (events are moments, never history).
  db.delete(schema.roomEvents)
    .where(lt(schema.roomEvents.createdAt, new Date(Date.now() - 60_000)))
    .catch(() => {});
}

export async function getEvent(id: number) {
  return db.query.roomEvents.findFirst({ where: eq(schema.roomEvents.id, id) });
}
