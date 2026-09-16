import { requireAccess } from "@/lib/access";
import { handler, json } from "@/lib/http";
import { listFiles } from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact } = await requireAccess(slug, "view", req);
  const files = await listFiles(artifact.id);
  return json({ files: files.map((f) => ({ ...f, updatedAt: f.updatedAt.toISOString() })) });
});
