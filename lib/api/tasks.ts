import type { Task } from "@/lib/types";

export async function fetchTasks(options?: {
  completed?: boolean;
  itemId?: string;
  projectId?: string;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (options?.completed === true) {
    params.set("completed", "true");
  } else if (options?.completed === false) {
    params.set("completed", "false");
  }
  if (options?.itemId) {
    params.set("itemId", options.itemId);
  }
  if (options?.projectId) {
    params.set("projectId", options.projectId);
  }
  const qs = params.toString();
  const res = await fetch(`/api/tasks${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error("Could not load tasks");
  }
  const data = (await res.json()) as { tasks?: Task[] };
  return Array.isArray(data.tasks) ? data.tasks : [];
}

export async function toggleTaskComplete(
  taskId: string,
  completed: boolean,
): Promise<Task> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not update task";
    throw new Error(err);
  }
  return data as Task;
}

export async function extractTasksFromRecording(
  recordingId: string,
): Promise<number> {
  const res = await fetch("/api/tasks/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not extract tasks";
    throw new Error(err);
  }
  return typeof data === "object" &&
    data !== null &&
    "tasksCreated" in data &&
    typeof (data as { tasksCreated: unknown }).tasksCreated === "number"
    ? (data as { tasksCreated: number }).tasksCreated
    : 0;
}
