import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import {
  createRecordingSegmentSignedUpload,
  getRecordingSegmentObjectPath,
} from "@/lib/supabase/storage";

const recordingIdSchema = z.uuid();
const projectIdSchema = z.uuid();

const postBodySchema = z.object({
  audioMimeType: z.string().max(200).optional(),
});

const DEFAULT_MIME = "audio/webm";

/**
 * Append a new audio segment to an existing recording (ordered after existing segments).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId: rawRecordingId } = await context.params;
  const idParse = recordingIdSchema.safeParse(rawRecordingId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid recording id" }, { status: 404 });
  }
  const recordingId = idParse.data;

  const url = new URL(request.url);
  const rawProjectId = url.searchParams.get("projectId");
  const p = projectIdSchema.safeParse(rawProjectId ?? "");
  if (!p.success) {
    return NextResponse.json(
      { error: "Query parameter projectId is required and must be a valid UUID" },
      { status: 400 },
    );
  }
  const projectId = p.data;

  let json: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      json = JSON.parse(text);
    }
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

  const audioMimeType = parsed.data.audioMimeType?.trim() || DEFAULT_MIME;
  const segmentId = randomUUID();

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();

    const { data: recording, error: recErr } = await supabase
      .from("note_recordings")
      .select("id, project_id, status")
      .eq("id", recordingId)
      .maybeSingle();

    if (recErr) {
      console.error("[POST .../segments] recording", recErr);
      return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
    }

    if (!recording || recording.project_id !== projectId) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    const { data: posRow, error: posErr } = await supabase
      .from("note_recording_segments")
      .select("position")
      .eq("recording_id", recordingId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (posErr) {
      console.error("[POST .../segments] max position", posErr);
      return NextResponse.json({ error: "Failed to prepare segment" }, { status: 500 });
    }

    const nextPosition = typeof posRow?.position === "number" ? posRow.position + 1 : 0;

    const audioStoragePath = getRecordingSegmentObjectPath(
      projectId,
      recordingId,
      segmentId,
      audioMimeType,
    );

    const { error: insErr } = await supabase.from("note_recording_segments").insert({
      id: segmentId,
      recording_id: recordingId,
      position: nextPosition,
      audio_storage_path: audioStoragePath,
      audio_mime_type: audioMimeType,
      status: "uploaded",
    });

    if (insErr) {
      console.error("[POST .../segments] insert", insErr);
      return NextResponse.json({ error: "Failed to create segment" }, { status: 500 });
    }

    const { error: parentUpdErr } = await supabase
      .from("note_recordings")
      .update({
        status: "uploaded",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);

    if (parentUpdErr) {
      console.error("[POST .../segments] parent update", parentUpdErr);
      await supabase.from("note_recording_segments").delete().eq("id", segmentId);
      return NextResponse.json({ error: "Failed to update recording" }, { status: 500 });
    }

    let signedUpload;
    try {
      signedUpload = await createRecordingSegmentSignedUpload(
        projectId,
        recordingId,
        segmentId,
        audioMimeType,
      );
    } catch (e) {
      console.error("[POST .../segments] signed upload", e);
      await supabase.from("note_recording_segments").delete().eq("id", segmentId);
      await supabase
        .from("note_recordings")
        .update({
          status: recording.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordingId);
      return NextResponse.json(
        { error: "Could not prepare storage upload for segment" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        recordingId,
        segmentId,
        position: nextPosition,
        audioStoragePath,
        storageBucket: env.SUPABASE_STORAGE_BUCKET_AUDIO,
        signedUpload: {
          signedUrl: signedUpload.signedUrl,
          token: signedUpload.token,
          path: signedUpload.path,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    console.error("[POST .../segments]", e);
    return NextResponse.json({ error: "Failed to create segment" }, { status: 500 });
  }
}
