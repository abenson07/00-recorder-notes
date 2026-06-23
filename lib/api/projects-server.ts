import { getAppOrigin } from "@/lib/server-origin";
import type { Item, ItemListRow, Project, RecordingListItem, RecordingsSummary } from "@/lib/types";

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

export async function fetchProjectItems(projectId: string): Promise<ItemListRow[]> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/projects/${projectId}/items`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchProjectItems]", res.status);
    return [];
  }

  const data = (await res.json()) as { items?: ItemListRow[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchItem(itemId: string): Promise<Item | null> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/items/${itemId}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    console.error("[fetchItem]", res.status, await res.text());
    return null;
  }

  return (await res.json()) as Item;
}

export async function fetchRecordingsSummary(
  itemId: string,
): Promise<RecordingsSummary> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/items/${itemId}/recordings/stats`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchRecordingsSummary]", res.status);
    return { total: 0, transcribed: 0, pending: 0 };
  }

  return (await res.json()) as RecordingsSummary;
}

export async function fetchItemRecordings(
  itemId: string,
): Promise<RecordingListItem[]> {
  const origin = await getAppOrigin();
  const res = await fetch(`${origin}/api/items/${itemId}/recordings`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchItemRecordings]", res.status);
    return [];
  }

  const data = (await res.json()) as { recordings?: RecordingListItem[] };
  return Array.isArray(data.recordings) ? data.recordings : [];
}

/** @deprecated Use fetchItem */
export async function fetchProjectAsItem(itemId: string): Promise<Item | null> {
  return fetchItem(itemId);
}

/** @deprecated Use fetchRecordingsSummary with itemId */
export const fetchProjectRecordings = fetchItemRecordings;
