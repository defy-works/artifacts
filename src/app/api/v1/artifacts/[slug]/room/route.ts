import { requireAccess } from "@/lib/access";
import { ApiError, handler, json, readJson } from "@/lib/http";
import { emit, heartbeat, leave, listPeers } from "@/lib/services/room";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "view", req);
  const body = await readJson<{ op: string; peer?: string; patch?: unknown; topic?: string; data?: unknown }>(req);
  const uid = viewer?.id ?? null;
  switch (body.op) {
    case "heartbeat":
      await heartbeat(artifact, uid, body.peer, body.patch);
      return json({ ok: true });
    case "leave":
      await leave(artifact, body.peer);
      return json({ ok: true });
    case "emit":
      await emit(artifact, uid, level, body.peer, body.topic, body.data);
      return json({ ok: true });
    case "peers":
      return json({ peers: await listPeers(artifact) });
    default:
      throw new ApiError(400, "invalid_argument", "unknown op");
  }
});
