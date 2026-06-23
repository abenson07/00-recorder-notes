import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const recordingIdSchema = z.uuid();
const itemIdSchema = z.uuid();

/** Optional `?itemId=` ensures the recording belongs to that item (recommended for UI routes). */
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
  const rawItemId = url.searchParams.get("itemId") ?? url.searchParams.get("projectId");
  let expectedItemId: string | undefined;
  if (rawItemId) {
    const p = itemIdSchema.safeParse(rawItemId);
    if (!p.success) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }
    expectedItemId = p.data;
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: row, error } = await supabase
      .from("note_recordings")
      .select(
        "id, item_id, status, audio_storage_path, audio_mime_type, duration_ms, transcript_text, cleaned_transcript_text, purpose_summary, transcription_raw, output_summary, output_summary_json, output_summary_debug, created_at, updated_at",
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

    if (expectedItemId && row.item_id !== expectedItemId) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (e) {
    console.error("[GET /api/recordings/:id]", e);
    return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
  }
}
