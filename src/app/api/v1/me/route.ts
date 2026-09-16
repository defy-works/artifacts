import { requireViewer } from "@/lib/access";
import { hasGoogle } from "@/lib/auth";
import { handler, json } from "@/lib/http";

export const GET = handler(async (req: Request) => {
  const v = await requireViewer(req);
  return json({ id: v.id, email: v.email, name: v.name, image: v.image, via: v.via, google: hasGoogle });
});
