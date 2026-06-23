"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchProjects } from "@/lib/api/projects";
import { EmptyState } from "@/components/common/EmptyState";

export function ProjectsMobileList() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-stone-500 md:hidden">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 md:hidden">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Projects</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Grouped collections of recordings
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Projects organize multiple recording items together."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="block rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/80"
              >
                <h2 className="font-medium">{p.title}</h2>
                {p.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
                    {p.description}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
