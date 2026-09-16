import { getAsset } from "@/lib/services/assets";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * Serves uploaded assets by their unguessable 32-hex id. Public by id, like
 * the platform's `/_blob/<id>`; CORS open so a sandboxed (opaque-origin)
 * artifact frame can `fetch()` its own data files.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const a = await getAsset(id);
  if (!a) return new Response("Not found", { status: 404 });
  return new Response(a.data as unknown as BodyInit, {
    headers: {
      "content-type": a.contentType,
      "content-length": String(a.sizeBytes),
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox",
    },
  });
}
