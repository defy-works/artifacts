import { requireAccess } from "@/lib/access";
import { handler, json } from "@/lib/http";
import { listAssets, uploadAsset } from "@/lib/services/assets";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact } = await requireAccess(slug, "edit", req);
  return json(await listAssets(artifact.id));
});

/** Raw body upload with `Content-Type` set to the asset's media type. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer } = await requireAccess(slug, "edit", req);
  const data = new Uint8Array(await req.arrayBuffer());
  const res = await uploadAsset(artifact, viewer!.id, data, req.headers.get("content-type"));
  return json(res, { status: 201 });
});
