import { requireViewer } from "@/lib/access";
import { handler, json } from "@/lib/http";
import { revokeToken } from "@/lib/services/tokens";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const v = await requireViewer(req);
  await revokeToken(v.id, (await params).id);
  return json({ ok: true });
});
