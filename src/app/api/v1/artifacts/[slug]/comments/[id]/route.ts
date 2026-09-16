import { requireAccess } from "@/lib/access";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { atLeast } from "@/lib/rules";
import { deleteComment, setResolved } from "@/lib/services/comments";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { artifact, viewer } = await requireAccess(slug, "view", req);
  if (!viewer) throw new ApiError(401, "unauthorized");
  const body = await readJson<{ resolved?: unknown }>(req);
  await setResolved(artifact, id, Boolean(body.resolved));
  return json({ ok: true });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "view", req);
  if (!viewer) throw new ApiError(401, "unauthorized");
  await deleteComment(artifact, viewer, id, atLeast(level, "edit"));
  return json({ ok: true });
});
