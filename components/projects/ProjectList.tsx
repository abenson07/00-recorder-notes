import type { Project } from "@/lib/types";
import { ProjectCard } from "./ProjectCard";

export function ProjectList({
  projects,
  appBasePath = "",
}: {
  projects: Project[];
  appBasePath?: string;
}) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {projects.map((p) => (
        <li key={p.id}>
          <ProjectCard project={p} appBasePath={appBasePath} />
        </li>
      ))}
    </ul>
  );
}
