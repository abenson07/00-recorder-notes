import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const projectIdSchema = z.uuid();
const MASTER_PREVIEW_LEN = 240;

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

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("[GET .../items] project", projectError);
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("items")
      .select(
        `
        id,
        title,
        description,
        project_id,
        updated_at,
        master_transcript,
        note_recordings (count)
      `,
      )
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[GET .../items]", error);
      return NextResponse.json({ error: "Failed to list items" }, { status: 500 });
    }

    type Row = {
      id: string;
      title: string;
      description: string | null;
      project_id: string | null;
      updated_at: string;
      master_transcript: string;
      note_recordings: { count: number }[] | null;
    };

    const items = ((data ?? []) as Row[]).map((row) => {
      const mt = row.master_transcript ?? "";
      const count = row.note_recordings?.[0]?.count ?? 0;
      return {
        id: row.id,
        title: row.title.trim() ? row.title : "Untitled item",
        description: row.description,
        project_id: row.project_id,
        updated_at: row.updated_at,
        master_transcript_preview: mt.slice(0, MASTER_PREVIEW_LEN),
        recordings_count: count,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[GET .../items]", e);
    return NextResponse.json({ error: "Failed to list items" }, { status: 500 });
  }
}
