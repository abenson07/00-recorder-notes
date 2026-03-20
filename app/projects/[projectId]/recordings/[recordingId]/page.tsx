import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRecording } from "@/lib/api/recordings";
import { fetchProject } from "@/lib/api/projects-server";
import { getAppOrigin } from "@/lib/server-origin";
import { RecordingDetailClient } from "@/components/recordings/RecordingDetailClient";
export default async function RecordingDetailPage({
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
      <nav className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/projects/${projectId}`}
          className="hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← {project.title}
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
