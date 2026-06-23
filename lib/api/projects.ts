import type { Project } from "@/lib/types";

type ProjectsListApiRow = {
  id: string;
  title: string;
  description: string | null;
  contextId: string | null;
  updatedAt: string;
  itemsCount: number;
};

/** Client-only: list parent projects from `GET /api/projects`. */
export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    throw new Error("Could not load projects");
  }

  const rows = (await res.json()) as ProjectsListApiRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title.trim() ? row.title : "Untitled project",
    description: row.description,
    context_id: row.contextId,
    created_at: row.updatedAt,
    updated_at: row.updatedAt,
  }));
}

export async function createProject(options?: {
  title?: string;
  description?: string | null;
}): Promise<Project> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: options?.title ?? "",
      description: options?.description ?? null,
    }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not create project";
    throw new Error(err);
  }
  return data as Project;
}

export async function patchProject(
  projectId: string,
  patch: {
    title?: string;
    description?: string | null;
    context_id?: string | null;
  },
): Promise<Project> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not update project";
    throw new Error(err);
  }
  return data as Project;
}

/** @deprecated Use createPlaceholderItem from lib/api/items */
export async function createPlaceholderProject(): Promise<string> {
  const { createPlaceholderItem } = await import("@/lib/api/items");
  return createPlaceholderItem();
}
