import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { createSignedAudioReadUrl } from "@/lib/supabase/storage";

const recordingIdSchema = z.uuid();
const projectIdSchema = z.uuid();

const expiresSchema = z.coerce.number().int().min(60).max(86400).optional();

/** Returns a short-lived signed URL for private-bucket audio (playback or manual download tests). */
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
    const { data: recording, error } = await supabase
      .from("note_recordings")
      .select("id, audio_storage_path, project_id")
      .eq("id", recordingId)
      .maybeSingle();

    if (error) {
      console.error("[GET /signed-audio]", error);
      return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
    }

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (expectedProjectId && recording.project_id !== expectedProjectId) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const signedUrl = await createSignedAudioReadUrl(recording.audio_storage_path, expiresIn);
    return NextResponse.json({
      recordingId: recording.id,
      signedUrl,
      expiresIn,
    });
  } catch (e) {
    console.error("[GET /signed-audio]", e);
    return NextResponse.json({ error: "Could not create signed read URL" }, { status: 500 });
  }
}
