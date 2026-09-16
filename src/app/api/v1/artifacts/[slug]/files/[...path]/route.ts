import { requireAccess } from "@/lib/access";
import { ApiError, handler, json } from "@/lib/http";
import { deleteFile, getFile, putFile } from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ slug: string; path: string[] }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug, path } = await params;
  const { artifact } = await requireAccess(slug, "view", req);
  const f = await getFile(artifact.id, path.join("/"));
  if (!f) throw new ApiError(404, "not_found");
  return new Response(f.data as unknown as BodyInit, {
    headers: { "content-type": f.contentType, "content-length": String(f.size), etag: `"${f.sha256}"` },
  });
});

/** Raw body upload; content type from the header, else the extension. */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const { slug, path } = await params;
  const { artifact } = await requireAccess(slug, "edit", req);
  const data = new Uint8Array(await req.arrayBuffer());
  const res = await putFile(artifact, path.join("/"), data, req.headers.get("content-type"));
  return json({ file: res });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { slug, path } = await params;
  const { artifact } = await requireAccess(slug, "edit", req);
  await deleteFile(artifact, path.join("/"));
  return json({ ok: true });
});
