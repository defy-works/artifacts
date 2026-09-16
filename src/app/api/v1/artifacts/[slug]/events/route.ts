import { requireAccess } from "@/lib/access";
import { errorResponse } from "@/lib/http";
import { bus, type RtEvent } from "@/lib/realtime";
import { getEvent, listPeers } from "@/lib/services/room";

type Ctx = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events for one artifact: doc invalidations, presence
 * snapshots, room moments, new versions, comments and metadata changes.
 * The client re-fetches what an invalidation names; room moments and
 * peers arrive whole.
 */
export async function GET(req: Request, { params }: Ctx) {
  let access;
  try {
    const { slug } = await params;
    access = await requireAccess(slug, "view", req);
  } catch (err) {
    return errorResponse(err);
  }
  const { artifact, viewer } = access;
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      send("hello", { artifactId: artifact.id, uid: viewer?.id ?? null, now: Date.now() });
      unsubscribe = await bus.subscribe(artifact.id, async (e: RtEvent) => {
        switch (e.type) {
          case "presence":
            send("peers", { peers: await listPeers(artifact) });
            break;
          case "room": {
            const row = await getEvent(e.id);
            if (row) send("room", { id: row.id, topic: row.topic, data: row.data, peer: row.peer, by: row.uid });
            break;
          }
          default:
            send(e.type, e);
        }
      });
      ping = setInterval(() => send("ping", { t: Date.now() }), 20_000);
    },
    cancel() {
      unsubscribe?.();
      if (ping) clearInterval(ping);
    },
  });

  req.signal.addEventListener("abort", () => {
    unsubscribe?.();
    if (ping) clearInterval(ping);
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
