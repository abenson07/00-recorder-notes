import type { Project, RecordingListItem, RecordingsSummary } from "@/lib/types";

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
    recordings_count: row.recordingsCount,
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

export async function patchProject(
  projectId: string,
  patch: {
    title?: string;
    description?: string | null;
    processing_template?: {
      preset: "summary" | "tasks";
      customInstructions?: string | null;
    };
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

/** Client: load one project from `GET /api/projects/:id`. */
export async function fetchProjectClient(projectId: string): Promise<Project | null> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Could not load project");
  }
  return (await res.json()) as Project;
}

/** Client: recording counts for a project. */
export async function fetchRecordingsSummaryClient(
  projectId: string,
): Promise<RecordingsSummary> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/recordings/stats`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    return { total: 0, transcribed: 0, pending: 0 };
  }
  return (await res.json()) as RecordingsSummary;
}

export async function fetchProjectRecordingsClient(
  projectId: string,
): Promise<RecordingListItem[]> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/recordings`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error("Could not load recordings");
  }
  const data = (await res.json()) as { recordings?: RecordingListItem[] };
  return Array.isArray(data.recordings) ? data.recordings : [];
}
