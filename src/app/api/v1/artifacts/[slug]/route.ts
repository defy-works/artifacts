import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAccess } from "@/lib/access";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { atLeast } from "@/lib/rules";
import {
  deleteArtifact,
  getVersion,
  listFiles,
  summarize,
  updateArtifact,
} from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ slug: string }> };

/** Metadata, the caller's level, the live HTML (unless ?html=0) and files. */
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "view", req);
  const url = new URL(req.url);
  const wantHtml = url.searchParams.get("html") !== "0";
  const [version, files, owner] = await Promise.all([
    getVersion(artifact),
    listFiles(artifact.id),
    db.query.user.findFirst({ where: eq(schema.user.id, artifact.ownerId), columns: { name: true } }),
  ]);
  const share =
    viewer && level !== "owner"
      ? await db.query.shares.findFirst({
          where: and(eq(schema.shares.artifactId, artifact.id), eq(schema.shares.email, viewer.email.toLowerCase())),
        })
      : null;
  return json({
    artifact: summarize(artifact, level, owner?.name ?? "Someone"),
    version: version
      ? { id: version.id, number: version.number, label: version.label, sha256: version.sha256, size: version.size, createdAt: version.createdAt.toISOString() }
      : null,
    html: wantHtml ? (version?.html ?? null) : null,
    files,
    viewer: viewer ? { id: viewer.id, name: viewer.name, email: viewer.email, image: viewer.image } : null,
    level,
    sharedVia: share ? "email" : level === "owner" ? "owner" : "link",
  });
});

async function update(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "edit", req);
  const body = await readJson<Record<string, any>>(req);
  const { artifact: a, version } = await updateArtifact(artifact, viewer!, body, level as "edit" | "owner");
  return json({
    artifact: summarize(a, level, ""),
    version: version ? { id: version.id, number: version.number, sha256: version.sha256 } : null,
  });
}
export const PATCH = handler(update);
export const PUT = handler(update);

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, level } = await requireAccess(slug, "owner", req);
  if (!atLeast(level, "owner")) throw new ApiError(403, "forbidden");
  await deleteArtifact(artifact);
  return json({ ok: true });
});
