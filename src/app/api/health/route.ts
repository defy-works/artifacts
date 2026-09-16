import { getSql } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getSql()`select 1`;
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 503 });
  }
}
