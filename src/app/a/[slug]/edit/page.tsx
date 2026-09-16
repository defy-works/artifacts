import { notFound, redirect } from "next/navigation";
import { getViewer, loadArtifact, resolveLevel } from "@/lib/access";
import { ApiError } from "@/lib/http";
import { atLeast } from "@/lib/rules";
import { getVersion, listFiles, summarize } from "@/lib/services/artifacts";
import { HtmlEditor } from "@/components/editor/HtmlEditor";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit" };

export default async function EditPage({ params }: Props) {
  const { slug } = await params;
  let artifact;
  try {
    artifact = await loadArtifact(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?from=${encodeURIComponent(`/a/${slug}/edit`)}`);
  const level = await resolveLevel(artifact, viewer);
  if (!atLeast(level, "edit")) redirect(`/a/${slug}`);
  const [version, files] = await Promise.all([getVersion(artifact), listFiles(artifact.id)]);
  return (
    <HtmlEditor
      artifact={summarize(artifact, level, "")}
      version={version ? { id: version.id, number: version.number } : null}
      html={version?.html ?? ""}
      files={files.map((f) => ({ path: f.path, size: f.size, contentType: f.contentType }))}
      level={level}
    />
  );
}
