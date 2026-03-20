import { getAppOrigin } from "@/lib/server-origin";
import type { Project, RecordingListItem, RecordingsSummary } from "@/lib/types";

export async function fetchProject(projectId: string): Promise<Project | null> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/projects/${projectId}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    console.error("[fetchProject]", res.status, await res.text());
    return null;
  }

  return (await res.json()) as Project;
}

export async function fetchRecordingsSummary(
  projectId: string,
): Promise<RecordingsSummary> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/projects/${projectId}/recordings/stats`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchRecordingsSummary]", res.status);
    return { total: 0, transcribed: 0, pending: 0 };
  }

  return (await res.json()) as RecordingsSummary;
}

export async function fetchProjectRecordings(
  projectId: string,
): Promise<RecordingListItem[]> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/projects/${projectId}/recordings`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchProjectRecordings]", res.status);
    return [];
  }

  const data = (await res.json()) as { recordings?: RecordingListItem[] };
  return Array.isArray(data.recordings) ? data.recordings : [];
}
