import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRecording } from "@/lib/api/recordings";
import { fetchProject } from "@/lib/api/projects-server";
import { getAppOrigin } from "@/lib/server-origin";
import { RecordingDetailClient } from "@/components/recordings/RecordingDetailClient";

export default async function LegacyRecordingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; recordingId: string }>;
}) {
  const { projectId, recordingId } = await params;
  const origin = await getAppOrigin();
  const [project, recording] = await Promise.all([
    fetchProject(projectId),
    fetchRecording(projectId, recordingId, { serverOrigin: origin }),
  ]);

  if (!project || !recording) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/legacy/projects/${projectId}`}
          className="hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← {project.title}
        </Link>
        <Link
          href="/"
          className="text-xs font-medium underline-offset-2 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
        >
          New UI
        </Link>
      </nav>

      <RecordingDetailClient
        projectId={projectId}
        recordingId={recordingId}
        initialRecording={recording}
      />
    </div>
  );
}
