import { requireAccess } from "@/lib/access";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { addComment, listComments } from "@/lib/services/comments";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact } = await requireAccess(slug, "view", req);
  return json({ comments: await listComments(artifact.id) });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer } = await requireAccess(slug, "view", req);
  if (!viewer) throw new ApiError(401, "unauthorized", "Sign in to comment");
  const body = await readJson<{ body: unknown; parentId?: unknown }>(req);
  return json({ comment: await addComment(artifact, viewer, body.body, body.parentId) }, { status: 201 });
});
