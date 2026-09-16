import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Artifact } from "@/db/schema";
import { ApiError } from "@/lib/http";
import { shortId } from "@/lib/ids";
import { publish } from "@/lib/realtime";
import type { Viewer } from "@/lib/access";

export async function listComments(artifactId: string) {
  const rows = await db.query.comments.findMany({
    where: eq(schema.comments.artifactId, artifactId),
    orderBy: schema.comments.createdAt,
  });
  return rows.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }));
}

export async function addComment(artifact: Artifact, by: Viewer, body: unknown, parentId?: unknown) {
  if (typeof body !== "string" || !body.trim()) throw new ApiError(400, "invalid_argument", "body is required");
  if (body.length > 4000) throw new ApiError(400, "invalid_argument", "comment exceeds 4000 characters");
  if (parentId !== undefined && parentId !== null && typeof parentId !== "string") {
    throw new ApiError(400, "invalid_argument", "parentId must be a string");
  }
  const [row] = await db
    .insert(schema.comments)
    .values({
      id: shortId(16),
      artifactId: artifact.id,
      parentId: (parentId as string | null | undefined) ?? null,
      authorId: by.id,
      authorName: by.name || by.email,
      body: body.trim(),
    })
    .returning();
  publish(artifact.id, { type: "comments" });
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function setResolved(artifact: Artifact, id: string, resolved: boolean) {
  await db.update(schema.comments).set({ resolved }).where(eq(schema.comments.id, id));
  publish(artifact.id, { type: "comments" });
}

export async function deleteComment(artifact: Artifact, by: Viewer, id: string, isEditor: boolean) {
  const c = await db.query.comments.findFirst({ where: eq(schema.comments.id, id) });
  if (!c || c.artifactId !== artifact.id) throw new ApiError(404, "not_found");
  if (c.authorId !== by.id && !isEditor) throw new ApiError(403, "forbidden");
  await db.delete(schema.comments).where(eq(schema.comments.id, id));
  publish(artifact.id, { type: "comments" });
}
