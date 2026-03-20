"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ProjectTabs } from "@/components/projects/ProjectTabs";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";
import { ProjectTemplatePanel } from "@/components/projects/ProjectTemplatePanel";
import { RecordingsList } from "@/components/projects/RecordingsList";
import { fetchProjectRecordingsClient } from "@/lib/api/projects";
import { cn } from "@/lib/cn";
import type { ProcessingTemplate } from "@/lib/projects/processingTemplate";
import type { RecordingListItem, RecordingsSummary } from "@/lib/types";

type DockMode = "overview" | "chat" | "recordings";

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function ProjectDetailClient({
  projectId,
  title,
  description,
  titleLocked,
  summary,
  masterTranscript,
  processingTemplate,
  stats,
  initialRecordings,
}: {
  projectId: string;
  title: string;
  description: string | null;
  titleLocked: boolean;
  summary: string;
  masterTranscript: string;
  processingTemplate: ProcessingTemplate;
  stats: RecordingsSummary;
  initialRecordings: RecordingListItem[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [dock, setDock] = useState<DockMode>("overview");
  const [recordOpen, setRecordOpen] = useState(false);

  const recordingsQuery = useQuery({
    queryKey: ["projectRecordings", projectId],
    queryFn: () => fetchProjectRecordingsClient(projectId),
    initialData: initialRecordings,
  });

  const displayTitle = title.trim() ? title : "Untitled project";

  return (
    <>
      <div className="mx-auto flex min-h-0 max-w-4xl flex-1 flex-col gap-6 px-4 py-8 pb-28">
        <header className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {displayTitle}
            </h1>
            {titleLocked ? (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Title locked
              </span>
            ) : null}
          </div>
          {description?.trim() ? (
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {stats.total} recordings · {stats.transcribed} transcribed ·{" "}
            {stats.pending} not yet transcribed
          </p>
        </header>

        {dock === "overview" ? (
          <div className="flex flex-col gap-6">
            {!titleLocked ? (
              <ProjectTemplatePanel projectId={projectId} initial={processingTemplate} />
            ) : null}
            <ProjectTabs masterTranscript={masterTranscript} summary={summary} />
          </div>
        ) : null}

        {dock === "chat" ? (
          <section className="min-h-[320px] flex-1 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="sr-only">Chat</h2>
            <ChatPanel projectId={projectId} />
          </section>
        ) : null}

        {dock === "recordings" ? (
          <section className="min-h-[280px] flex-1 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Recordings
            </h2>
            <RecordingsList
              projectId={projectId}
              items={recordingsQuery.data ?? []}
            />
          </section>
        ) : null}
      </div>

      <RecordModal
        open={recordOpen}
        projectId={projectId}
        onOpenChange={setRecordOpen}
        onUploaded={async (recordingId) => {
          setRecordOpen(false);
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          await queryClient.invalidateQueries({
            queryKey: ["projectRecordings", projectId],
          });
          router.push(`/projects/${projectId}/recordings/${recordingId}`);
          router.refresh();
        }}
      />

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
        aria-label="Project actions"
      >
        <div className="mx-auto flex max-w-4xl items-end justify-between gap-4 pb-2">
          <button
            type="button"
            onClick={() => setDock("chat")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium transition-colors",
              dock === "chat"
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
            aria-pressed={dock === "chat"}
          >
            <ChatIcon />
            Chat
          </button>

          <div className="flex flex-1 flex-col items-center justify-end">
            <RecordButton
              variant="fab"
              label="Record"
              className="-mt-6 shadow-lg"
              onClick={() => setRecordOpen(true)}
            />
            <span className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Record
            </span>
          </div>

          <button
            type="button"
            onClick={() => setDock("recordings")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium transition-colors",
              dock === "recordings"
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
            aria-pressed={dock === "recordings"}
          >
            <ListIcon />
            Recordings
          </button>
        </div>

        {dock !== "overview" ? (
          <div className="mx-auto flex max-w-4xl justify-center border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setDock("overview")}
              className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Back to Summary / Transcript
            </button>
          </div>
        ) : null}
      </nav>
    </>
  );
}
