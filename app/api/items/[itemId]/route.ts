import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const itemIdSchema = z.uuid();

const patchBodySchema = z
  .object({
    title: z.string().max(2000).optional(),
    description: z.string().max(8000).nullable().optional(),
    project_id: z.string().uuid().nullable().optional(),
    processing_template: z
      .object({
        preset: z.enum(["summary", "tasks"]),
        customInstructions: z.string().max(8000).nullable().optional(),
      })
      .optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.project_id !== undefined ||
      v.processing_template !== undefined,
    { message: "Provide at least one field to update" },
  );

export async function GET(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId: rawId } = await context.params;
  const idParse = itemIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 404 });
  }
  const itemId = idParse.data;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("items")
      .select(
        "id, title, description, project_id, direction_files, title_locked, master_transcript, summary, processing_template, created_at, updated_at",
      )
      .eq("id", itemId)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/items/:id]", error);
      return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/items/:id]", e);
    return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId: rawId } = await context.params;
  const idParse = itemIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 404 });
  }
  const itemId = idParse.data;

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
      .from("items")
      .select("id, title_locked")
      .eq("id", itemId)
      .maybeSingle();

    if (loadError) {
      console.error("[PATCH /api/items/:id] load", loadError);
      return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (
      existing.title_locked &&
      (parsed.data.title !== undefined || parsed.data.description !== undefined)
    ) {
      return NextResponse.json(
        {
          error: "Item title is locked; description and title cannot be updated",
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
    if (parsed.data.project_id !== undefined) {
      patch.project_id = parsed.data.project_id;
    }
    if (parsed.data.processing_template !== undefined) {
      patch.processing_template = {
        preset: parsed.data.processing_template.preset,
        customInstructions:
          parsed.data.processing_template.customInstructions?.trim() || null,
      };
    }

    const { data, error } = await supabase
      .from("items")
      .update(patch)
      .eq("id", itemId)
      .select(
        "id, title, description, project_id, direction_files, title_locked, master_transcript, summary, processing_template, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      console.error("[PATCH /api/items/:id] update", error);
      return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("[PATCH /api/items/:id]", e);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}
