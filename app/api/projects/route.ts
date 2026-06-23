import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const postBodySchema = z.object({
  title: z.string().max(2000).optional(),
  description: z.string().max(8000).nullable().optional(),
  context_id: z.string().uuid().nullable().optional(),
});

type ProjectListRow = {
  id: string;
  title: string;
  description: string | null;
  context_id: string | null;
  updated_at: string;
  items: { count: number }[] | null;
};

function itemCountFromRow(row: ProjectListRow): number {
  const first = row.items?.[0];
  return typeof first?.count === "number" ? first.count : 0;
}

/** List parent projects (groups of items). */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("projects")
      .select(
        `
        id,
        title,
        description,
        context_id,
        updated_at,
        items (count)
      `,
      )
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[GET /api/projects]", error);
      return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
    }

    const rows = (data ?? []) as ProjectListRow[];
    const payload = rows.map((row) => ({
      id: row.id,
      title: row.title.trim() ? row.title : "Untitled project",
      description: row.description,
      contextId: row.context_id,
      updatedAt: row.updated_at,
      itemsCount: itemCountFromRow(row),
    }));

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/projects]", e);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
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

  const title = parsed.data.title !== undefined ? parsed.data.title : "";
  const description =
    parsed.data.description === undefined ? null : parsed.data.description;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        title,
        description,
        context_id: parsed.data.context_id ?? null,
      })
      .select("id, title, description, context_id, created_at, updated_at")
      .single();

    if (error || !data) {
      console.error("[POST /api/projects]", error);
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    console.error("[POST /api/projects]", e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
