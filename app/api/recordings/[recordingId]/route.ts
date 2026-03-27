import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const recordingIdSchema = z.uuid();
const projectIdSchema = z.uuid();

/** Optional `?projectId=` ensures the recording belongs to that project (recommended for UI routes). */
export async function GET(
  request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId: rawId } = await context.params;
  const idParse = recordingIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid recording id" }, { status: 404 });
  }
  const recordingId = idParse.data;

  const url = new URL(request.url);
  const rawProjectId = url.searchParams.get("projectId");
  let expectedProjectId: string | undefined;
  if (rawProjectId) {
    const p = projectIdSchema.safeParse(rawProjectId);
    if (!p.success) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }
    expectedProjectId = p.data;
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: row, error } = await supabase
      .from("note_recordings")
      .select(
        "id, project_id, status, audio_storage_path, audio_mime_type, duration_ms, transcript_text, transcription_raw, output_summary, output_summary_json, output_summary_debug, created_at, updated_at",
      )
      .eq("id", recordingId)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/recordings/:id]", error);
      return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (expectedProjectId && row.project_id !== expectedProjectId) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const { data: segmentRows, error: segError } = await supabase
      .from("note_recording_segments")
      .select("id, position, audio_mime_type, duration_ms, status")
      .eq("recording_id", recordingId)
      .order("position", { ascending: true });

    if (segError) {
      console.error("[GET /api/recordings/:id] segments", segError);
      return NextResponse.json({ ...row, segments: [] });
    }

    const segments = (segmentRows ?? []).map((s) => ({
      id: s.id,
      position: s.position,
      audio_mime_type: s.audio_mime_type,
      duration_ms: s.duration_ms,
      status: s.status,
    }));

    return NextResponse.json({ ...row, segments });
  } catch (e) {
    console.error("[GET /api/recordings/:id]", e);
    return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
  }
}
