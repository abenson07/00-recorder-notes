"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjects } from "@/lib/api/projects";
import { EmptyState } from "@/components/common/EmptyState";
import { ProjectList } from "@/components/projects/ProjectList";
import { RecordButton } from "@/components/record/RecordButton";

export function MainListView() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading projects…
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Projects
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Record voice notes; transcripts roll up per project.
          </p>
        </header>

        {projects.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16">
            <EmptyState
              title="No projects yet"
              description="Create a project by recording your first note. Integration with Supabase comes in a later task."
              action={<RecordButton />}
            />
          </div>
        ) : (
          <ProjectList projects={projects} />
        )}
      </div>

      {projects.length > 0 ? (
        <div className="pointer-events-none fixed bottom-8 left-0 right-0 flex justify-center px-4">
          <div className="pointer-events-auto">
            <RecordButton variant="fab" label="Record" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
