import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Artifact, Role } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { shortId } from "@/lib/ids";
import { publish } from "@/lib/realtime";
import { sendEmail, shareInviteMail } from "@/lib/email";
import { siteUrl } from "@/lib/services/artifacts";

const ROLES = new Set(["view", "interact", "edit"]);

export async function listShares(artifactId: string) {
  const rows = await db.query.shares.findMany({ where: eq(schema.shares.artifactId, artifactId) });
  return rows.map((s) => ({ email: s.email, role: s.role, createdAt: s.createdAt.toISOString() }));
}

export async function upsertShare(artifact: Artifact, by: { id: string; name: string }, email: unknown, role: unknown) {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "invalid_argument", "a valid email is required");
  }
  if (typeof role !== "string" || !ROLES.has(role)) throw new ApiError(400, "invalid_argument", "role must be view|interact|edit");
  const e = email.toLowerCase();
  const inserted = await db
    .insert(schema.shares)
    .values({ id: shortId(16), artifactId: artifact.id, email: e, role: role as Role, invitedBy: by.id })
    .onConflictDoUpdate({ target: [schema.shares.artifactId, schema.shares.email], set: { role: role as Role } })
    .returning({ createdAt: schema.shares.createdAt });
  publish(artifact.id, { type: "meta" });
  // Invite mail on a fresh share only (a role change is silent).
  const fresh = inserted[0] && Date.now() - inserted[0].createdAt.getTime() < 5_000;
  if (fresh) {
    sendEmail(
      shareInviteMail(e, { inviter: by.name || "Someone", title: artifact.title, role: role as string, url: `${siteUrl()}/a/${artifact.slug}` }),
    ).catch((err) => console.error("[email] share invite failed", err));
  }
}

export async function removeShare(artifact: Artifact, email: unknown) {
  if (typeof email !== "string") throw new ApiError(400, "invalid_argument", "email required");
  await db
    .delete(schema.shares)
    .where(and(eq(schema.shares.artifactId, artifact.id), eq(schema.shares.email, email.toLowerCase())));
  publish(artifact.id, { type: "meta" });
}
