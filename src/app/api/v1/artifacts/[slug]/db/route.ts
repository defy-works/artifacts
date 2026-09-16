import { requireAccess } from "@/lib/access";
import { ApiError, handler, json, readJson } from "@/lib/http";
import {
  acquireLease,
  deleteDoc,
  getDoc,
  queryCollection,
  setDoc,
  updateDoc,
  type Actor,
} from "@/lib/services/docstore";
import type { Artifact } from "@/db/schema";

type Ctx = { params: Promise<{ slug: string }> };

interface Op {
  op: "get" | "query" | "list" | "set" | "update" | "delete" | "acquire" | "batch";
  path?: string;
  collection?: string;
  filters?: Array<{ field: string; op: string; value: unknown }>;
  orderBy?: { field: string; dir: "asc" | "desc" } | null;
  limit?: number | null;
  data?: unknown;
  holder?: string;
  ttlMs?: number;
  ops?: Op[];
}

async function run(artifact: Artifact, actor: Actor, op: Op): Promise<unknown> {
  switch (op.op) {
    case "get":
      return getDoc(artifact, actor, String(op.path));
    case "query":
    case "list":
      return queryCollection(artifact, actor, {
        collection: String(op.collection),
        filters: op.filters,
        orderBy: op.orderBy ?? null,
        limit: op.limit ?? null,
      });
    case "set":
      await setDoc(artifact, actor, String(op.path), op.data);
      return { ok: true };
    case "update":
      await updateDoc(artifact, actor, String(op.path), op.data);
      return { ok: true };
    case "delete":
      await deleteDoc(artifact, actor, String(op.path));
      return { ok: true };
    case "acquire":
      return acquireLease(artifact, actor, String(op.path), {
        holder: String(op.holder),
        ttlMs: op.ttlMs,
        data: op.data as Record<string, unknown> | undefined,
      });
    case "batch": {
      const ops = Array.isArray(op.ops) ? op.ops.slice(0, 100) : [];
      const results = [];
      for (const inner of ops) {
        if (inner.op === "batch") throw new ApiError(400, "invalid_argument", "nested batch");
        try {
          results.push({ ok: true, result: await run(artifact, actor, inner) });
        } catch (err) {
          results.push({ ok: false, error: err instanceof ApiError ? { code: err.code, message: err.message } : { code: "internal", message: String(err) } });
        }
      }
      return { results };
    }
    default:
      throw new ApiError(400, "invalid_argument", `unknown op "${(op as Op).op}"`);
  }
}

/**
 * Document-store RPC. Reads need `view` (anonymous link viewers included);
 * writes are gated by the artifact's declared rules on top of the caller's
 * level. The GET form is a convenience for `get`/`query` from a shell.
 */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "view", req);
  const body = await readJson<Op>(req);
  return json(await run(artifact, { uid: viewer?.id ?? null, level }, body));
});

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { slug } = await params;
  const { artifact, viewer, level } = await requireAccess(slug, "view", req);
  const u = new URL(req.url);
  const path = u.searchParams.get("path");
  const collection = u.searchParams.get("collection");
  if (path) return json(await run(artifact, { uid: viewer?.id ?? null, level }, { op: "get", path }));
  if (collection) return json(await run(artifact, { uid: viewer?.id ?? null, level }, { op: "query", collection, limit: Number(u.searchParams.get("limit") ?? 1000) }));
  throw new ApiError(400, "invalid_argument", "path or collection required");
});
