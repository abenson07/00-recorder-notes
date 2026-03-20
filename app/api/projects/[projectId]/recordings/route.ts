import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { getServerEnv } from "@/lib/env";
import { createRecordingSignedUpload, getRecordingObjectPath } from "@/lib/supabase/storage";

const projectIdSchema = z.uuid();

const postBodySchema = z.object({
  audioMimeType: z.string().max(200).optional(),
});

const DEFAULT_MIME = "audio/webm";

const PREVIEW_MAX = 160;

function previewFromRecording(row: {
  output_summary: string | null;
  transcript_text: string | null;
}): string | null {
  const raw =
    (row.output_summary?.trim() && row.output_summary) ||
    (row.transcript_text?.trim() && row.transcript_text) ||
    "";
  if (!raw) {
    return null;
  }
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length <= PREVIEW_MAX) {
    return oneLine;
  }
  return `${oneLine.slice(0, PREVIEW_MAX - 1)}…`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawProjectId } = await context.params;
  const idParse = projectIdSchema.safeParse(rawProjectId);
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
      console.error("[GET .../recordings] project", projectError);
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from("note_recordings")
      .select("id, status, created_at, transcript_text, output_summary")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET .../recordings]", error);
      return NextResponse.json({ error: "Failed to load recordings" }, { status: 500 });
    }

    const recordings = (rows ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      preview: previewFromRecording(r),
    }));

    return NextResponse.json({ recordings });
  } catch (e) {
    console.error("[GET .../recordings]", e);
    return NextResponse.json({ error: "Failed to load recordings" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawProjectId } = await context.params;
  const idParse = projectIdSchema.safeParse(rawProjectId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 404 });
  }
  const projectId = idParse.data;

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
  const recordingId = randomUUID();
  const audioStoragePath = getRecordingObjectPath(recordingId, projectId);

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError) {
      console.error("[POST .../recordings] project", projectError);
      return NextResponse.json({ error: "Failed to validate project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error: insertError } = await supabase.from("note_recordings").insert({
      id: recordingId,
      project_id: projectId,
      status: "uploaded",
      audio_storage_path: audioStoragePath,
      audio_mime_type: audioMimeType,
    });

    if (insertError) {
      console.error("[POST .../recordings] insert", insertError);
      return NextResponse.json({ error: "Failed to create recording" }, { status: 500 });
    }

    let signedUpload;
    try {
      signedUpload = await createRecordingSignedUpload(recordingId, projectId);
    } catch (e) {
      console.error("[POST .../recordings] signed upload", e);
      await supabase.from("note_recordings").delete().eq("id", recordingId);
      return NextResponse.json(
        { error: "Could not prepare storage upload for recording" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        recordingId,
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
    console.error("[POST .../recordings]", e);
    return NextResponse.json({ error: "Failed to create recording" }, { status: 500 });
  }
}
