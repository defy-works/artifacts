import { requireAccess } from "@/lib/access";
import { handler, json } from "@/lib/http";
import { listVersions } from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact } = await requireAccess(slug, "view", req);
  const versions = await listVersions(artifact.id);
  return json({
    current: artifact.currentVersionId,
    versions: versions.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })),
  });
});
