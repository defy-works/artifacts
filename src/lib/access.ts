import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { ApiError } from "@/lib/http";
import { atLeast, maxRole, type Level } from "@/lib/rules";
import type { Artifact } from "@/db/schema";

export interface Viewer {
  id: string;
  email: string;
  name: string;
  image: string | null;
  /** How the caller authenticated. */
  via: "session" | "token";
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Resolve the caller: a Bearer API token (the skill), else the better-auth
 * session cookie (the browser). `null` for anonymous.
 */
export async function getViewer(req?: Request): Promise<Viewer | null> {
  const h = req ? req.headers : await headers();
  const authz = h.get("authorization");
  if (authz?.toLowerCase().startsWith("bearer ")) {
    const token = authz.slice(7).trim();
    const row = await db.query.apiTokens.findFirst({
      where: eq(schema.apiTokens.tokenHash, hashToken(token)),
    });
    if (!row) throw new ApiError(401, "unauthorized", "Invalid API token");
    const u = await db.query.user.findFirst({ where: eq(schema.user.id, row.userId) });
    if (!u) throw new ApiError(401, "unauthorized", "Token owner no longer exists");
    // Touch lastUsedAt at most once a minute.
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      db.update(schema.apiTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(schema.apiTokens.id, row.id))
        .catch(() => {});
    }
    return { id: u.id, email: u.email, name: u.name, image: u.image ?? null, via: "token" };
  }
  const session = await auth.api.getSession({ headers: h });
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? null,
    via: "session",
  };
}

export async function requireViewer(req?: Request): Promise<Viewer> {
  const v = await getViewer(req);
  if (!v) throw new ApiError(401, "unauthorized", "Sign in required");
  return v;
}

/** The viewer's effective level on an artifact. */
export async function resolveLevel(artifact: Artifact, viewer: Viewer | null): Promise<Level> {
  if (viewer && artifact.ownerId === viewer.id) return "owner";
  let shared: Level | null = null;
  if (viewer) {
    const share = await db.query.shares.findFirst({
      where: and(
        eq(schema.shares.artifactId, artifact.id),
        eq(schema.shares.email, viewer.email.toLowerCase()),
      ),
    });
    shared = share?.role ?? null;
  }
  return maxRole(shared, artifact.linkAccess);
}

export async function loadArtifact(slug: string): Promise<Artifact> {
  const a = await db.query.artifacts.findFirst({ where: eq(schema.artifacts.slug, slug) });
  if (!a) throw new ApiError(404, "not_found", "No such artifact");
  return a;
}

export interface Access {
  artifact: Artifact;
  viewer: Viewer | null;
  level: Level;
}

/**
 * Load an artifact and the caller's level, enforcing a minimum. An
 * artifact the caller may not see 404s rather than 403s, so its existence
 * is never leaked.
 */
export async function requireAccess(slug: string, min: Level, req?: Request): Promise<Access> {
  const [artifact, viewer] = await Promise.all([loadArtifact(slug), getViewer(req)]);
  const level = await resolveLevel(artifact, viewer);
  if (level === "none") throw new ApiError(404, "not_found", "No such artifact");
  if (!atLeast(level, min)) {
    throw new ApiError(403, "forbidden", `This action needs ${min} access`);
  }
  return { artifact, viewer, level };
}
