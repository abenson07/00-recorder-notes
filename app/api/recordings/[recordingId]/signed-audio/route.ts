import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { createSignedAudioReadUrl } from "@/lib/supabase/storage";

const recordingIdSchema = z.uuid();
const itemIdSchema = z.uuid();

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
    const { data: recording, error } = await supabase
      .from("note_recordings")
      .select("id, audio_storage_path, item_id")
      .eq("id", recordingId)
      .maybeSingle();

    if (error) {
      console.error("[GET /signed-audio]", error);
      return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
    }

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (expectedItemId && recording.item_id !== expectedItemId) {
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
