import { requireViewer } from "@/lib/access";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { createToken, listTokens } from "@/lib/services/tokens";

export const GET = handler(async (req: Request) => {
  const v = await requireViewer(req);
  return json({ tokens: await listTokens(v.id) });
});

export const POST = handler(async (req: Request) => {
  const v = await requireViewer(req);
  if (v.via !== "session") throw new ApiError(403, "forbidden", "Create tokens from the web app");
  const body = await readJson(req);
  return json(await createToken(v.id, v.email, body.name), { status: 201 });
});
