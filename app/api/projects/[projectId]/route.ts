import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { GET as itemGet, PATCH as itemPatch } from "@/app/api/items/[itemId]/route";

const idSchema = z.uuid();

/**
 * Backward compat: if id is an item, proxy to item API.
 * If id is a parent project, return project detail.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawId } = await context.params;
  const idParse = idSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 404 });
  }
  const id = idParse.data;

  const supabase = createServiceRoleClient();
  const { data: item } = await supabase.from("items").select("id").eq("id", id).maybeSingle();
  if (item) {
    return itemGet(request, { params: Promise.resolve({ itemId: id }) });
  }

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, description, context_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawId } = await context.params;
  const idParse = idSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 404 });
  }
  const id = idParse.data;

  const supabase = createServiceRoleClient();
  const { data: item } = await supabase.from("items").select("id").eq("id", id).maybeSingle();
  if (item) {
    return itemPatch(request, { params: Promise.resolve({ itemId: id }) });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .update(json as Record<string, unknown>)
    .eq("id", id)
    .select("id, title, description, context_id, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
  return NextResponse.json(data);
}
