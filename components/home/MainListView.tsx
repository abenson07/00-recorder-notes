"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { GlobalSearchSection } from "@/components/home/GlobalSearchSection";
import { ProjectList } from "@/components/projects/ProjectList";
import { createPlaceholderProject, fetchProjects } from "@/lib/api/projects";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";

export function MainListView({ appBasePath = "" }: { appBasePath?: string }) {
  const router = useRouter();
  const base = appBasePath.replace(/\/$/, "");
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordProjectId, setRecordProjectId] = useState<string | null>(null);
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
      const id = await createPlaceholderProject();
      setRecordProjectId(id);
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
    <div className="relative flex flex-1 flex-col">
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
            Record voice notes; transcripts roll up per project.
          </p>
        </header>

        <GlobalSearchSection
          onSearchActiveChange={setSearchActive}
          appBasePath={appBasePath}
        />

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
          <ProjectList projects={projects} appBasePath={appBasePath} />
        )}
      </div>

      {projects.length > 0 ? (
        <div className="pointer-events-none fixed bottom-8 left-0 right-0 flex justify-center px-4">
          <div className="pointer-events-auto">
            <RecordButton
              variant="fab"
              label="Record"
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => void beginRecording()}
              disabled={creatingProject}
            />
          </div>
        </div>
      ) : null}

      <RecordModal
        open={recordOpen}
        projectId={recordProjectId}
        onOpenChange={(next) => {
          setRecordOpen(next);
          if (!next) {
            setRecordProjectId(null);
          }
        }}
        onUploaded={async (recordingId) => {
          const pid = recordProjectId;
          setRecordOpen(false);
          setRecordProjectId(null);
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          if (pid) {
            router.push(`${base}/projects/${pid}/recordings/${recordingId}`);
          }
        }}
      />
    </div>
  );
}
