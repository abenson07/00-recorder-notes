import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { createSignedAudioReadUrl } from "@/lib/supabase/storage";

const recordingIdSchema = z.uuid();
const projectIdSchema = z.uuid();

const expiresSchema = z.coerce.number().int().min(60).max(86400).optional();

/** Signed read URLs for all segments in playback order. */
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
  const expParse = expiresSchema.safeParse(url.searchParams.get("expiresIn") ?? undefined);
  const expiresIn = expParse.success ? (expParse.data ?? 3600) : 3600;

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
    const { data: recording, error: recErr } = await supabase
      .from("note_recordings")
      .select("id, project_id")
      .eq("id", recordingId)
      .maybeSingle();

    if (recErr) {
      console.error("[GET /signed-playlist] recording", recErr);
      return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
    }

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (expectedProjectId && recording.project_id !== expectedProjectId) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const { data: rows, error: segErr } = await supabase
      .from("note_recording_segments")
      .select("id, position, audio_storage_path, audio_mime_type")
      .eq("recording_id", recordingId)
      .order("position", { ascending: true });

    if (segErr) {
      console.error("[GET /signed-playlist] segments", segErr);
      return NextResponse.json({ error: "Failed to load segments" }, { status: 500 });
    }

    const segments = rows ?? [];
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No audio segments for this recording", code: "NO_SEGMENTS" },
        { status: 404 },
      );
    }

    const items = await Promise.all(
      segments.map(async (s) => {
        const signedUrl = await createSignedAudioReadUrl(s.audio_storage_path, expiresIn);
        return {
          segmentId: s.id,
          position: s.position,
          signedUrl,
          mimeType: s.audio_mime_type,
        };
      }),
    );

    return NextResponse.json({
      recordingId,
      expiresIn,
      segments: items,
    });
  } catch (e) {
    console.error("[GET /signed-playlist]", e);
    return NextResponse.json({ error: "Could not create signed read URLs" }, { status: 500 });
  }
}
