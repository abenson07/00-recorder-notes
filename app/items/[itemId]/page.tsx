import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchItem,
  fetchItemRecordings,
  fetchRecordingsSummary,
} from "@/lib/api/projects-server";
import { ProjectDetailClient } from "@/components/projects/ProjectDetailClient";
import { parseProcessingTemplate } from "@/lib/projects/processingTemplate";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const [item, stats, recordings] = await Promise.all([
    fetchItem(itemId),
    fetchRecordingsSummary(itemId),
    fetchItemRecordings(itemId),
  ]);

  if (!item) {
    notFound();
  }

  const processingTemplate = parseProcessingTemplate(item.processing_template);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-4xl px-4 pt-8">
        <nav className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="hover:text-zinc-800 dark:hover:text-zinc-200 md:hidden">
            ← Home
          </Link>
          <Link href="/" className="hidden hover:text-zinc-800 dark:hover:text-zinc-200 md:inline">
            ← All items
          </Link>
        </nav>
      </div>

      <ProjectDetailClient
        projectId={itemId}
        title={item.title}
        description={item.description}
        titleLocked={item.title_locked}
        summary={item.summary}
        masterTranscript={item.master_transcript}
        processingTemplate={processingTemplate}
        stats={stats}
        initialRecordings={recordings}
      />
    </div>
  );
}
