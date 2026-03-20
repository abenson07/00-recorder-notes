import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const projectIdSchema = z.uuid();

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
      console.error("[recordings/stats] project", projectError);
      return NextResponse.json({ error: "Failed to validate project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from("note_recordings")
      .select("status")
      .eq("project_id", projectId);

    if (rowsError) {
      console.error("[recordings/stats] rows", rowsError);
      return NextResponse.json({ error: "Failed to load recordings" }, { status: 500 });
    }

    const list = rows ?? [];
    const total = list.length;
    let transcribed = 0;
    for (const row of list) {
      if (row.status === "transcribed") {
        transcribed += 1;
      }
    }
    const pending = total - transcribed;

    return NextResponse.json({ total, transcribed, pending });
  } catch (e) {
    console.error("[recordings/stats]", e);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
