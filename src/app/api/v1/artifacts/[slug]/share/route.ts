import { requireAccess } from "@/lib/access";
import { handler, json, readJson } from "@/lib/http";
import { assertLinkAccess, updateArtifact } from "@/lib/services/artifacts";
import { listShares, removeShare, upsertShare } from "@/lib/services/shares";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact } = await requireAccess(slug, "owner", req);
  return json({ linkAccess: artifact.linkAccess, shares: await listShares(artifact.id) });
});

/** `{linkAccess?, add?: [{email, role}], remove?: [email]}` */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer } = await requireAccess(slug, "owner", req);
  const body = await readJson<{ linkAccess?: unknown; add?: Array<{ email: unknown; role: unknown }>; remove?: unknown[] }>(req);
  if (body.linkAccess !== undefined) {
    assertLinkAccess(body.linkAccess);
    await updateArtifact(artifact, viewer!, { linkAccess: body.linkAccess }, "owner");
  }
  for (const s of body.add ?? []) await upsertShare(artifact, { id: viewer!.id, name: viewer!.name }, s.email, s.role);
  for (const e of body.remove ?? []) await removeShare(artifact, e);
  const fresh = await requireAccess(slug, "owner", req);
  return json({ linkAccess: fresh.artifact.linkAccess, shares: await listShares(artifact.id) });
});
