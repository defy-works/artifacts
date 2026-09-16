import { requireAccess } from "@/lib/access";
import { handler, json } from "@/lib/http";
import { deleteAsset } from "@/lib/services/assets";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { artifact } = await requireAccess(slug, "edit", req);
  return json(await deleteAsset(artifact.id, id));
});
