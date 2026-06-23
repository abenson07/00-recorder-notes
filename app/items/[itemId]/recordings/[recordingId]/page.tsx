import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRecording } from "@/lib/api/recordings";
import { fetchItem } from "@/lib/api/projects-server";
import { getAppOrigin } from "@/lib/server-origin";
import { RecordingDetailClient } from "@/components/recordings/RecordingDetailClient";

export default async function ItemRecordingDetailPage({
  params,
}: {
  params: Promise<{ itemId: string; recordingId: string }>;
}) {
  const { itemId, recordingId } = await params;
  const origin = await getAppOrigin();
  const [item, recording] = await Promise.all([
    fetchItem(itemId),
    fetchRecording(itemId, recordingId, { serverOrigin: origin }),
  ]);

  if (!item || !recording) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <nav className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href={`/items/${itemId}`}
          className="hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← {item.title.trim() ? item.title : "Untitled item"}
        </Link>
      </nav>

      <RecordingDetailClient
        projectId={itemId}
        itemId={itemId}
        recordingId={recordingId}
        initialRecording={recording}
      />
    </div>
  );
}
