import type { Item, ItemListRow, RecordingListItem } from "@/lib/types";

/** Client-only: list items from `GET /api/items`. */
export async function fetchItems(options?: {
  unsorted?: boolean;
  projectId?: string;
}): Promise<ItemListRow[]> {
  const params = new URLSearchParams();
  if (options?.unsorted) {
    params.set("unsorted", "true");
  }
  if (options?.projectId) {
    params.set("projectId", options.projectId);
  }
  const qs = params.toString();
  const res = await fetch(`/api/items${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error("Could not load items");
  }
  return (await res.json()) as ItemListRow[];
}

export async function fetchItem(itemId: string): Promise<Item | null> {
  const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Could not load item");
  }
  return (await res.json()) as Item;
}

/** Create a placeholder item (empty title) before the first save/transcript. */
export async function createPlaceholderItem(projectId?: string | null): Promise<string> {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "",
      ...(projectId ? { project_id: projectId } : {}),
    }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok || typeof data !== "object" || data === null || !("id" in data)) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not create item";
    throw new Error(err);
  }
  return String((data as { id: string }).id);
}

export async function createItem(options?: {
  title?: string;
  projectId?: string | null;
}): Promise<Item> {
  const res = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: options?.title ?? "",
      project_id: options?.projectId ?? null,
    }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not create item";
    throw new Error(err);
  }
  return data as Item;
}

export async function patchItem(
  itemId: string,
  patch: {
    title?: string;
    description?: string | null;
    project_id?: string | null;
    processing_template?: {
      preset: "summary" | "tasks";
      customInstructions?: string | null;
    };
  },
): Promise<Item> {
  const res = await fetch(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not update item";
    throw new Error(err);
  }
  return data as Item;
}

export async function fetchItemRecordingsClient(
  itemId: string,
): Promise<RecordingListItem[]> {
  const res = await fetch(
    `/api/items/${encodeURIComponent(itemId)}/recordings`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    throw new Error("Could not load recordings");
  }
  const data = (await res.json()) as { recordings?: RecordingListItem[] };
  return Array.isArray(data.recordings) ? data.recordings : [];
}
