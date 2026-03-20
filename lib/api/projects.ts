import type { Project, RecordingsSummary } from "@/lib/types";

function stubProject(projectId: string): Project {
  const now = new Date().toISOString();
  return {
    id: projectId,
    title: "Stub project (replace with API)",
    description: "Placeholder until GET /api/projects/:projectId is implemented.",
    direction_files: null,
    title_locked: false,
    master_transcript:
      "This master transcript is scaffold data. Real content will append here after recordings transcribe.",
    summary: "Stub summary pane — wire to live `projects.summary` after transcript + summary pipeline.",
    created_at: now,
    updated_at: now,
  };
}

/** Placeholder list; replace with GET /api/projects when wired up. */
export async function fetchProjects(): Promise<Project[]> {
  return [];
}

/** Placeholder detail — returns a stub for any id so routes are previewable. */
export async function fetchProject(projectId: string): Promise<Project | null> {
  return stubProject(projectId);
}

/** Placeholder summary for project detail header. */
export async function fetchRecordingsSummary(
  projectId: string,
): Promise<RecordingsSummary> {
  void projectId;
  return { total: 0, transcribed: 0, pending: 0 };
}
