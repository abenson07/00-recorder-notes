import type { Project } from "@/lib/types";

type ProjectsListApiRow = {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  masterTranscriptPreview: string;
  recordingsCount: number;
};

/** Client-only: list projects from `GET /api/projects`. */
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
    direction_files: null,
    title_locked: false,
    master_transcript: row.masterTranscriptPreview,
    summary: "",
    created_at: row.updatedAt,
    updated_at: row.updatedAt,
  }));
}

/** Create a placeholder project (empty title) before the first save/transcript. */
export async function createPlaceholderProject(): Promise<string> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "" }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok || typeof data !== "object" || data === null || !("id" in data)) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not create project";
    throw new Error(err);
  }
  return String((data as { id: string }).id);
}
