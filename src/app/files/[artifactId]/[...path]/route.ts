import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFile } from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ artifactId: string; path: string[] }> };

export const dynamic = "force-dynamic";

/**
 * Serves an artifact's supporting files at the base URL the viewer injects
 * (`<base href="/_files/<artifactId>/">`). The artifact id is a 16-char
 * random string, so this is public-by-secret exactly like `/_blob/`.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { artifactId, path } = await params;
  const a = await db.query.artifacts.findFirst({ where: eq(schema.artifacts.id, artifactId), columns: { id: true } });
  if (!a) return new Response("Not found", { status: 404 });
  const f = await getFile(artifactId, path.join("/"));
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(f.data as unknown as BodyInit, {
    headers: {
      "content-type": f.contentType,
      "content-length": String(f.size),
      etag: `"${f.sha256}"`,
      "cache-control": "no-cache",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox allow-scripts",
    },
  });
}
