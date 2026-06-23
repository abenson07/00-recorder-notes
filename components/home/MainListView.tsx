"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { GlobalSearchSection } from "@/components/home/GlobalSearchSection";
import { ProjectList } from "@/components/projects/ProjectList";
import { createPlaceholderItem } from "@/lib/api/items";
import { fetchProjects } from "@/lib/api/projects";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";

export function MainListView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordItemId, setRecordItemId] = useState<string | null>(null);
  const [recordSessionError, setRecordSessionError] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const beginRecording = async () => {
    setRecordSessionError(null);
    setCreatingProject(true);
    try {
      const id = await createPlaceholderItem();
      setRecordItemId(id);
      setRecordOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) {
      setRecordSessionError(
        e instanceof Error ? e.message : "Could not start recording. Try again.",
      );
    } finally {
      setCreatingProject(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading projects…
      </div>
    );
  }

  return (
    <div className="relative hidden flex-1 flex-col md:flex">
      {recordSessionError ? (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6">
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-100"
          >
            {recordSessionError}
          </p>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Projects
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Record voice notes; group items into projects on mobile or desktop.
          </p>
        </header>

        <GlobalSearchSection onSearchActiveChange={setSearchActive} />

        {projects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <EmptyState
              title="No projects yet"
              description="Tap record to create a project and capture your first note."
              action={
                <RecordButton
                  onClick={() => void beginRecording()}
                  disabled={creatingProject}
                />
              }
            />
          </div>
        ) : searchActive ? null : (
          <ProjectList projects={projects} />
        )}
      </div>

      {projects.length > 0 ? (
        <div className="pointer-events-none fixed bottom-8 left-0 right-0 flex justify-center px-4">
          <div className="pointer-events-auto">
            <RecordButton
              variant="fab"
              label="Record"
              onClick={() => void beginRecording()}
              disabled={creatingProject}
            />
          </div>
        </div>
      ) : null}

      <RecordModal
        open={recordOpen}
        itemId={recordItemId}
        onOpenChange={(next) => {
          setRecordOpen(next);
          if (!next) {
            setRecordItemId(null);
          }
        }}
        onUploaded={async (recordingId) => {
          const iid = recordItemId;
          setRecordOpen(false);
          setRecordItemId(null);
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          await queryClient.invalidateQueries({ queryKey: ["items"] });
          if (iid) {
            router.push(`/items/${iid}/recordings/${recordingId}`);
          }
        }}
      />
    </div>
  );
}
