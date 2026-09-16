import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import { hashToken } from "@/lib/access";
import { ApiError } from "@/lib/http";
import { shortId } from "@/lib/ids";

export async function listTokens(userId: string) {
  const rows = await db.query.apiTokens.findMany({ where: eq(schema.apiTokens.userId, userId) });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    prefix: t.prefix,
    createdAt: t.createdAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
  }));
}

/** Mint a token. The plaintext is returned exactly once. */
export async function createToken(userId: string, email: string, name: unknown) {
  if (typeof name !== "string" || !name.trim()) throw new ApiError(400, "invalid_argument", "name is required");
  const secret = randomBytes(24).toString("base64url");
  const token = `art_${secret}`;
  const prefix = token.slice(0, 10);
  const [row] = await db
    .insert(schema.apiTokens)
    .values({ id: shortId(16), userId, name: name.trim().slice(0, 60), prefix, tokenHash: hashToken(token) })
    .returning();
  void email;
  return { id: row.id, name: row.name, prefix, token, createdAt: row.createdAt.toISOString() };
}

export async function revokeToken(userId: string, id: string) {
  await db.delete(schema.apiTokens).where(and(eq(schema.apiTokens.userId, userId), eq(schema.apiTokens.id, id)));
}
