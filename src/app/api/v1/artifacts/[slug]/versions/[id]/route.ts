import { requireAccess } from "@/lib/access";
import { ApiError, handler, json } from "@/lib/http";
import { getVersion } from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { artifact } = await requireAccess(slug, "view", req);
  const v = await getVersion(artifact, id);
  if (!v || v.artifactId !== artifact.id) throw new ApiError(404, "not_found");
  return json({
    version: { id: v.id, number: v.number, label: v.label, sha256: v.sha256, size: v.size, createdAt: v.createdAt.toISOString() },
    html: v.html,
  });
});
