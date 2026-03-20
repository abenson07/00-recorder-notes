import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { refreshProjectSummary } from "@/lib/openai/projectSummary";
import {
  OPENAI_MAX_AUDIO_BYTES,
  OpenAITranscriptionError,
  transcribeAudio,
} from "@/lib/openai/transcribe";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

export const maxDuration = 300;

function filenameFromStoragePath(storagePath: string, mime: string): string {
  const base = storagePath.split("/").pop() || "recording";
  if (base.includes(".")) {
    return base;
  }
  if (mime.includes("webm")) {
    return `${base}.webm`;
  }
  if (mime.includes("wav")) {
    return `${base}.wav`;
  }
  if (mime.includes("mpeg") || mime.includes("mp3")) {
    return `${base}.mp3`;
  }
  if (mime.includes("mp4") || mime.includes("m4a")) {
    return `${base}.m4a`;
  }
  return `${base}.webm`;
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const { recordingId } = await context.params;
  const env = getServerEnv();
  const supabase = createServiceRoleClient();
  const bucket = env.SUPABASE_STORAGE_BUCKET_AUDIO;

  const { data: recording, error: fetchError } = await supabase
    .from("note_recordings")
    .select(
      "id, project_id, status, audio_storage_path, audio_mime_type, transcript_text",
    )
    .eq("id", recordingId)
    .maybeSingle();

  if (fetchError) {
    console.error("[start-transcription] fetch recording", fetchError);
    return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
  }

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }

  if (!recording.project_id) {
    return NextResponse.json(
      { error: "Recording has no project; cannot update master transcript", code: "NO_PROJECT" },
      { status: 400 },
    );
  }

  if (
    recording.status === "transcribed" &&
    recording.transcript_text &&
    recording.transcript_text.length > 0
  ) {
    return NextResponse.json({
      ok: true,
      idempotent: true,
      recordingId: recording.id,
      status: recording.status,
      transcriptPreview: recording.transcript_text.slice(0, 280),
    });
  }

  if (recording.status === "transcription_pending") {
    return NextResponse.json(
      {
        error: "Transcription already in progress for this recording",
        code: "TRANSCRIPTION_PENDING",
      },
      { status: 409 },
    );
  }

  if (recording.status !== "uploaded" && recording.status !== "failed") {
    return NextResponse.json(
      { error: `Cannot start transcription from status: ${recording.status}` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const { data: claimed, error: pendingErr } = await supabase
    .from("note_recordings")
    .update({ status: "transcription_pending", updated_at: now })
    .eq("id", recordingId)
    .in("status", ["uploaded", "failed"])
    .select("id");

  if (pendingErr) {
    console.error("[start-transcription] set pending", pendingErr);
    return NextResponse.json({ error: "Failed to update recording" }, { status: 500 });
  }

  if (!claimed?.length) {
    const { data: again } = await supabase
      .from("note_recordings")
      .select("id, status, transcript_text")
      .eq("id", recordingId)
      .maybeSingle();
    if (again?.status === "transcribed" && again.transcript_text) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        recordingId: again.id,
        status: again.status,
        transcriptPreview: again.transcript_text.slice(0, 280),
      });
    }
    return NextResponse.json(
      {
        error: "Transcription already in progress for this recording",
        code: "TRANSCRIPTION_PENDING",
      },
      { status: 409 },
    );
  }

  const { data: storageBlob, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(recording.audio_storage_path);

  if (downloadError || !storageBlob) {
    console.error("[start-transcription] storage download", downloadError);
    await supabase
      .from("note_recordings")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", recordingId);
    return NextResponse.json(
      { error: "Could not download audio from storage", code: "STORAGE_DOWNLOAD" },
      { status: 502 },
    );
  }

  const byteSize = storageBlob.size;
  if (byteSize > OPENAI_MAX_AUDIO_BYTES) {
    await supabase
      .from("note_recordings")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        transcription_raw: {
          error: "AUDIO_TOO_LARGE",
          maxBytes: OPENAI_MAX_AUDIO_BYTES,
          actualBytes: byteSize,
        },
      })
      .eq("id", recordingId);
    return NextResponse.json(
      {
        error: `Audio exceeds OpenAI’s ${OPENAI_MAX_AUDIO_BYTES / (1024 * 1024)} MB per-file limit. Compress, shorten, or split the recording.`,
        code: "AUDIO_TOO_LARGE",
        maxBytes: OPENAI_MAX_AUDIO_BYTES,
        actualBytes: byteSize,
      },
      { status: 413 },
    );
  }

  const fileName = filenameFromStoragePath(
    recording.audio_storage_path,
    recording.audio_mime_type || storageBlob.type || "application/octet-stream",
  );

  try {
    const { text, raw } = await transcribeAudio({
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      audio: storageBlob,
      filename: fileName,
    });

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, master_transcript, summary")
      .eq("id", recording.project_id)
      .maybeSingle();

    if (projectError || !project) {
      console.error("[start-transcription] load project", projectError);
      await supabase
        .from("note_recordings")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", recordingId);
      return NextResponse.json({ error: "Project not found" }, { status: 500 });
    }

    const block = `\n\n[Recording ${recordingId}]\n${text}\n`;
    const masterTranscript = (project.master_transcript ?? "").trimEnd() + block;

    let summaryNext = project.summary ?? "";
    try {
      summaryNext = await refreshProjectSummary({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        previousSummary: project.summary ?? "",
        newTranscriptText: text,
      });
    } catch (e) {
      console.error("[start-transcription] summary refresh", e);
      summaryNext = project.summary ?? "";
    }

    const { error: projectUpdateError } = await supabase
      .from("projects")
      .update({
        master_transcript: masterTranscript,
        summary: summaryNext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recording.project_id);

    if (projectUpdateError) {
      console.error("[start-transcription] update project", projectUpdateError);
      await supabase
        .from("note_recordings")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", recordingId);
      return NextResponse.json({ error: "Failed to update project transcript" }, { status: 500 });
    }

    const { error: recordingUpdateError } = await supabase
      .from("note_recordings")
      .update({
        status: "transcribed",
        transcript_text: text,
        transcription_raw: raw,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);

    if (recordingUpdateError) {
      console.error("[start-transcription] update recording", recordingUpdateError);
      return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      recordingId,
      status: "transcribed",
      transcriptPreview: text.slice(0, 280),
    });
  } catch (e) {
    if (e instanceof OpenAITranscriptionError) {
      await supabase
        .from("note_recordings")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          transcription_raw: {
            error: e.message,
            code: e.code,
            status: e.status,
          },
        })
        .eq("id", recordingId);

      const status = e.status >= 400 && e.status < 600 ? e.status : 502;
      return NextResponse.json(
        { error: e.message, code: e.code ?? "OPENAI_ERROR" },
        { status: status === 401 || status === 413 || status === 429 ? status : 502 },
      );
    }

    console.error("[start-transcription]", e);
    await supabase
      .from("note_recordings")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", recordingId);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
