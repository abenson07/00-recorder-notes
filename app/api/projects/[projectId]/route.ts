import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const projectIdSchema = z.uuid();

const patchBodySchema = z
  .object({
    title: z.string().max(2000).optional(),
    description: z.string().max(8000).nullable().optional(),
  })
  .refine((v) => v.title !== undefined || v.description !== undefined, {
    message: "Provide title and/or description",
  });

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawId } = await context.params;
  const idParse = projectIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 404 });
  }
  const projectId = idParse.data;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, title, description, direction_files, title_locked, master_transcript, summary, created_at, updated_at",
      )
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/projects/:id]", error);
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/projects/:id]", e);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawId } = await context.params;
  const idParse = projectIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 404 });
  }
  const projectId = idParse.data;

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
    const { data: existing, error: loadError } = await supabase
      .from("projects")
      .select("id, title_locked")
      .eq("id", projectId)
      .maybeSingle();

    if (loadError) {
      console.error("[PATCH /api/projects/:id] load", loadError);
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (existing.title_locked) {
      return NextResponse.json(
        {
          error: "Project title is locked; description and title cannot be updated",
          code: "TITLE_LOCKED",
        },
        { status: 409 },
      );
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) {
      patch.title = parsed.data.title;
    }
    if (parsed.data.description !== undefined) {
      patch.description = parsed.data.description;
    }

    const { data, error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId)
      .select(
        "id, title, description, direction_files, title_locked, master_transcript, summary, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      console.error("[PATCH /api/projects/:id] update", error);
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[PATCH /api/projects/:id]", e);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
