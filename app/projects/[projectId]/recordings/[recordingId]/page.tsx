import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRecording } from "@/lib/api/recordings";
import { fetchProject } from "@/lib/api/projects";
import { AudioPlayer } from "@/components/playback/AudioPlayer";
import { SearchableTextPane } from "@/components/text/SearchableTextPane";
import { WaveformRecorder } from "@/components/record/WaveformRecorder";
import { RecordingTransportControls } from "@/components/record/RecordingTransportControls";

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; recordingId: string }>;
}) {
  const { projectId, recordingId } = await params;
  const [project, recording] = await Promise.all([
    fetchProject(projectId),
    fetchRecording(projectId, recordingId),
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

      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Recording
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{recordingId}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Status:{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {recording.status}
          </span>
        </p>
      </header>

      <WaveformRecorder />
      <RecordingTransportControls />

      <AudioPlayer label="This recording" />

      <SearchableTextPane
        title="Transcript"
        body={recording.transcript_text ?? ""}
      />
    </div>
  );
}
