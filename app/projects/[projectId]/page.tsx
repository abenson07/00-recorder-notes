import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchProject,
  fetchRecordingsSummary,
} from "@/lib/api/projects-server";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { AudioPlayer } from "@/components/playback/AudioPlayer";
import { ProjectRecordFab } from "@/components/projects/ProjectRecordFab";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, summary] = await Promise.all([
    fetchProject(projectId),
    fetchRecordingsSummary(projectId),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-0 max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <nav className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          ← All projects
        </Link>
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {project.title}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {summary.total} recordings · {summary.transcribed} transcribed ·{" "}
          {summary.pending} not yet transcribed
        </p>
      </header>

      <ProjectTabs
        projectId={projectId}
        masterTranscript={project.master_transcript}
        summary={project.summary}
      />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Latest audio (placeholder)
        </h2>
        <AudioPlayer />
      </section>

      <ProjectRecordFab projectId={projectId} />
    </div>
  );
}
