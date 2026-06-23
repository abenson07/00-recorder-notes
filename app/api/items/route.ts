import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const MASTER_PREVIEW_LEN = 240;

const postBodySchema = z.object({
  title: z.string().max(2000).optional(),
  description: z.string().max(8000).nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
});

type DbRow = {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  updated_at: string;
  master_transcript: string;
  note_recordings: { count: number }[] | null;
  projects: { title: string } | { title: string }[] | null;
};

function recordingsCountFromRow(row: DbRow): number {
  const first = row.note_recordings?.[0];
  return typeof first?.count === "number" ? first.count : 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unsortedOnly = searchParams.get("unsorted") === "true";
  const projectId = searchParams.get("projectId");

  try {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from("items")
      .select(
        `
        id,
        title,
        description,
        project_id,
        updated_at,
        master_transcript,
        note_recordings (count),
        projects (title)
      `,
      )
      .order("updated_at", { ascending: false });

    if (unsortedOnly) {
      query = query.is("project_id", null);
    } else if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/items]", error);
      return NextResponse.json({ error: "Failed to list items" }, { status: 500 });
    }

    type Row = DbRow;

    const rows = (data ?? []) as Row[];
    const payload = rows.map((row) => {
      const mt = row.master_transcript ?? "";
      const projectTitle = Array.isArray(row.projects)
        ? row.projects[0]?.title
        : row.projects?.title;
      return {
        id: row.id,
        title: row.title.trim() ? row.title : "Untitled item",
        description: row.description,
        project_id: row.project_id,
        project_title: projectTitle?.trim() || null,
        updated_at: row.updated_at,
        master_transcript_preview: mt.slice(0, MASTER_PREVIEW_LEN),
        recordings_count: recordingsCountFromRow(row),
      };
    });

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[GET /api/items]", e);
    return NextResponse.json({ error: "Failed to list items" }, { status: 500 });
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
      .from("items")
      .insert({
        title,
        description,
        project_id: parsed.data.project_id ?? null,
        title_locked: false,
        master_transcript: "",
        summary: "",
        processing_template: { preset: "summary" },
      })
      .select(
        "id, title, description, project_id, direction_files, title_locked, master_transcript, summary, processing_template, created_at, updated_at",
      )
      .single();

    if (error || !data) {
      console.error("[POST /api/items]", error);
      return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    console.error("[POST /api/items]", e);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
