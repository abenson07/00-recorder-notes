import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchProject,
  fetchProjectRecordings,
  fetchRecordingsSummary,
} from "@/lib/api/projects-server";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [project, stats, recordings] = await Promise.all([
    fetchProject(projectId),
    fetchRecordingsSummary(projectId),
    fetchProjectRecordings(projectId),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-4xl px-4 pt-8">
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            ← All projects
          </Link>
        </nav>
      </div>

      <ProjectDetailClient
        projectId={projectId}
        title={project.title}
        description={project.description}
        titleLocked={project.title_locked}
        summary={project.summary}
        masterTranscript={project.master_transcript}
        stats={stats}
        initialRecordings={recordings}
      />
    </div>
  );
}
