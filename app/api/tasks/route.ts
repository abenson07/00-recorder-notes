import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const getQuerySchema = z.object({
  completed: z.enum(["true", "false"]).optional(),
  itemId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

const postBodySchema = z.object({
  title: z.string().min(1).max(2000),
  details: z.string().max(8000).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).nullable().optional(),
  item_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = getQuerySchema.safeParse({
    completed: url.searchParams.get("completed") ?? undefined,
    itemId: url.searchParams.get("itemId") ?? undefined,
    projectId: url.searchParams.get("projectId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  try {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from("tasks")
      .select(
        "id, item_id, project_id, source_recording_id, title, details, priority, completed_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (parsed.data.completed === "true") {
      query = query.not("completed_at", "is", null);
    } else if (parsed.data.completed === "false") {
      query = query.is("completed_at", null);
    }

    if (parsed.data.itemId) {
      query = query.eq("item_id", parsed.data.itemId);
    }
    if (parsed.data.projectId) {
      query = query.eq("project_id", parsed.data.projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/tasks]", error);
      return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
    }

    return NextResponse.json({ tasks: data ?? [] });
  } catch (e) {
    console.error("[GET /api/tasks]", e);
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: parsed.data.title,
        details: parsed.data.details ?? null,
        priority: parsed.data.priority ?? null,
        item_id: parsed.data.item_id ?? null,
        project_id: parsed.data.project_id ?? null,
      })
      .select(
        "id, item_id, project_id, source_recording_id, title, details, priority, completed_at, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      console.error("[POST /api/tasks]", error);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tasks]", e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
