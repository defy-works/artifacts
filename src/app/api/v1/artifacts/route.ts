import { requireViewer } from "@/lib/access";
import { handler, json, readJson } from "@/lib/http";
import { createArtifact, listForViewer, summarize } from "@/lib/services/artifacts";

export const GET = handler(async (req: Request) => {
  const v = await requireViewer(req);
  return json(await listForViewer(v));
});

export const POST = handler(async (req: Request) => {
  const v = await requireViewer(req);
  const body = await readJson<Record<string, any>>(req);
  const a = await createArtifact(v, {
    slug: body.slug,
    title: body.title,
    description: body.description,
    favicon: body.favicon,
    html: body.html,
    capabilities: body.capabilities,
    linkAccess: body.linkAccess,
    label: body.label,
  });
  return json({ artifact: summarize(a, "owner", v.name) }, { status: 201 });
});
