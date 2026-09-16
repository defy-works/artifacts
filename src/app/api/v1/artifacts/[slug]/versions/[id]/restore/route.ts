import { requireAccess } from "@/lib/access";
import { ApiError, handler, json } from "@/lib/http";
import { getVersion, updateArtifact } from "@/lib/services/artifacts";

type Ctx = { params: Promise<{ slug: string; id: string }> };

/** Restore = publish the old HTML as a new version (history stays linear). */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "edit", req);
  const v = await getVersion(artifact, id);
  if (!v || v.artifactId !== artifact.id) throw new ApiError(404, "not_found");
  const { version } = await updateArtifact(artifact, viewer!, { html: v.html, label: `Restored v${v.number}` }, level as "edit" | "owner");
  return json({ version: { id: version!.id, number: version!.number } });
});
