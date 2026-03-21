import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchProject,
  fetchProjectRecordings,
  fetchRecordingsSummary,
} from "@/lib/api/projects-server";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { parseProcessingTemplate } from "@/lib/projects/processingTemplate";

export default async function LegacyProjectDetailPage({
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

  const processingTemplate = parseProcessingTemplate(project.processing_template);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-4xl px-4 pt-8">
        <nav className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/legacy" className="hover:text-zinc-800 dark:hover:text-zinc-200">
            ← All projects
          </Link>
          <Link
            href="/"
            className="text-xs font-medium underline-offset-2 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
          >
            New UI
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
        processingTemplate={processingTemplate}
        stats={stats}
        initialRecordings={recordings}
        appBasePath="/legacy"
      />
    </div>
  );
}
