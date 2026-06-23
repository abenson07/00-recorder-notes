import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const taskIdSchema = z.uuid();

const patchBodySchema = z
  .object({
    title: z.string().min(1).max(2000).optional(),
    details: z.string().max(8000).nullable().optional(),
    priority: z.enum(["low", "medium", "high"]).nullable().optional(),
    completed: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.details !== undefined ||
      v.priority !== undefined ||
      v.completed !== undefined,
    { message: "Provide at least one field to update" },
  );

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId: rawId } = await context.params;
  const idParse = taskIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 404 });
  }
  const taskId = idParse.data;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const patch: Record<string, unknown> = {};

    if (parsed.data.title !== undefined) {
      patch.title = parsed.data.title;
    }
    if (parsed.data.details !== undefined) {
      patch.details = parsed.data.details;
    }
    if (parsed.data.priority !== undefined) {
      patch.priority = parsed.data.priority;
    }
    if (parsed.data.completed !== undefined) {
      patch.completed_at = parsed.data.completed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", taskId)
      .select(
        "id, item_id, project_id, source_recording_id, title, details, priority, completed_at, created_at, updated_at",
      )
      .single();

    if (error) {
      console.error("[PATCH /api/tasks/:id]", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[PATCH /api/tasks/:id]", e);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId: rawId } = await context.params;
  const idParse = taskIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 404 });
  }
  const taskId = idParse.data;

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      console.error("[DELETE /api/tasks/:id]", error);
      return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/tasks/:id]", e);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
