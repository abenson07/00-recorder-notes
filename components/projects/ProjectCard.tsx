import Link from "next/link";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/cn";

export function ProjectCard({
  project,
  className,
  appBasePath = "",
}: {
  project: Project;
  className?: string;
  /** e.g. `/legacy` so links resolve under `/legacy/projects/...` */
  appBasePath?: string;
}) {
  const base = appBasePath.replace(/\/$/, "");
  return (
    <Link
      href={`${base}/projects/${project.id}`}
      className={cn(
        "block rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
        {project.title}
      </h3>
      {project.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
          {project.description}
        </p>
      ) : (
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
          No description
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
        Updated {new Date(project.updated_at).toLocaleDateString()}
      </p>
    </Link>
  );
}
