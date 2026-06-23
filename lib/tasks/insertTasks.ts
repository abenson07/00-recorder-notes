import type { SupabaseClient } from "@supabase/supabase-js";
import type { TasksOutputPayload } from "@/lib/openai/recordingOutput";

export async function insertTasksFromPayload({
  supabase,
  payload,
  itemId,
  projectId,
  sourceRecordingId,
}: {
  supabase: SupabaseClient;
  payload: TasksOutputPayload;
  itemId?: string | null;
  projectId?: string | null;
  sourceRecordingId?: string | null;
}): Promise<number> {
  if (payload.tasks.length === 0) {
    return 0;
  }

  const rows = payload.tasks.map((t) => ({
    item_id: itemId ?? null,
    project_id: projectId ?? null,
    source_recording_id: sourceRecordingId ?? null,
    title: t.title,
    details: t.details?.trim() || null,
    priority: t.priority ?? null,
  }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) {
    throw new Error(error.message || "Failed to insert tasks");
  }
  return rows.length;
}
