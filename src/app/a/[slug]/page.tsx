import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer, loadArtifact, resolveLevel } from "@/lib/access";
import { ApiError } from "@/lib/http";
import { getVersion, hasFiles, summarize } from "@/lib/services/artifacts";
import { ArtifactViewer } from "@/components/viewer/ArtifactViewer";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

async function load(slug: string) {
  let artifact;
  try {
    artifact = await loadArtifact(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
  const viewer = await getViewer();
  const level = await resolveLevel(artifact, viewer);
  return { artifact, viewer, level };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await load(slug);
  if (!r || r.level === "none") return { title: "Artifact" };
  return { title: r.artifact.title, description: r.artifact.description ?? undefined };
}

export default async function ArtifactPage({ params }: Props) {
  const { slug } = await params;
  const r = await load(slug);
  if (!r) notFound();
  const { artifact, viewer, level } = r;
  if (level === "none") {
    if (!viewer) redirect(`/login?from=${encodeURIComponent(`/a/${slug}`)}`);
    notFound();
  }
  const [version, files] = await Promise.all([getVersion(artifact), hasFiles(artifact.id)]);
  return (
    <ArtifactViewer
      initial={{
        artifact: summarize(artifact, level, ""),
        html: version?.html ?? "<!doctype html><html><body></body></html>",
        version: version ? { id: version.id, number: version.number } : null,
        hasFiles: files,
        level,
        viewer: viewer ? { id: viewer.id, name: viewer.name, email: viewer.email } : null,
      }}
    />
  );
}
