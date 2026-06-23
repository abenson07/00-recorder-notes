import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { applyRecordingProcessingTemplate } from "@/lib/openai/recordingOutput";
import { refreshOpenOutputsForItem } from "@/lib/openai/outputs";
import { refreshProjectSummary } from "@/lib/openai/projectSummary";
import {
  analyzePurpose,
  cleanTranscript,
  generateItemTitle,
} from "@/lib/openai/transcriptProcessing";
import {
  OPENAI_MAX_AUDIO_BYTES,
  OpenAITranscriptionError,
  transcribeAudio,
} from "@/lib/openai/transcribe";
import { parseProcessingTemplate } from "@/lib/projects/processingTemplate";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { ingestRecordingTranscriptChunks } from "@/lib/transcripts/ingestRecordingChunks";
import { insertTasksFromPayload } from "@/lib/tasks/insertTasks";
import { tasksOutputPayloadSchema } from "@/lib/openai/recordingOutput";

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
      "id, item_id, status, audio_storage_path, audio_mime_type, transcript_text",
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

  if (!recording.item_id) {
    return NextResponse.json(
      { error: "Recording has no item; cannot update master transcript", code: "NO_ITEM" },
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
        error: `Audio exceeds OpenAI's ${OPENAI_MAX_AUDIO_BYTES / (1024 * 1024)} MB per-file limit. Compress, shorten, or split the recording.`,
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

    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id, title, title_locked, master_transcript, summary, processing_template, project_id")
      .eq("id", recording.item_id)
      .maybeSingle();

    if (itemError || !item) {
      console.error("[start-transcription] load item", itemError);
      await supabase
        .from("note_recordings")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", recordingId);
      return NextResponse.json({ error: "Item not found" }, { status: 500 });
    }

    let contextMd: string | null = null;
    let projectDescription: string | null = null;
    if (item.project_id) {
      const { data: parentProject } = await supabase
        .from("projects")
        .select("description, context_id")
        .eq("id", item.project_id)
        .maybeSingle();
      projectDescription = parentProject?.description ?? null;
      if (parentProject?.context_id) {
        const { data: ctx } = await supabase
          .from("contexts")
          .select("content_md")
          .eq("id", parentProject.context_id)
          .maybeSingle();
        contextMd = ctx?.content_md ?? null;
      }
    }

    let purposeSummary = "";
    try {
      purposeSummary = await analyzePurpose({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        transcriptText: text,
        contextMd,
        projectDescription,
      });
    } catch (e) {
      console.error("[start-transcription] purpose analysis", e);
      purposeSummary = text.trim().slice(0, 280);
    }

    const { count: priorRecordingCount } = await supabase
      .from("note_recordings")
      .select("id", { count: "exact", head: true })
      .eq("item_id", recording.item_id)
      .eq("status", "transcribed");

    const isFirstRecording = (priorRecordingCount ?? 0) === 0;
    if (isFirstRecording && !item.title?.trim() && !item.title_locked) {
      try {
        const generatedTitle = await generateItemTitle({
          apiKey: env.OPENAI_API_KEY,
          baseUrl: env.OPENAI_BASE_URL,
          purposeSummary,
        });
        await supabase
          .from("items")
          .update({ title: generatedTitle, updated_at: new Date().toISOString() })
          .eq("id", recording.item_id);
      } catch (e) {
        console.error("[start-transcription] title generation", e);
      }
    }

    let cleanedText = text;
    try {
      cleanedText = await cleanTranscript({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        rawTranscript: text,
        purposeSummary,
        contextMd,
        projectDescription,
      });
    } catch (e) {
      console.error("[start-transcription] clean transcript", e);
    }

    const block = `\n\n[Recording ${recordingId}]\n${cleanedText}\n`;
    const masterTranscript = (item.master_transcript ?? "").trimEnd() + block;

    const template = parseProcessingTemplate(item.processing_template);

    let summaryNext = item.summary ?? "";
    try {
      summaryNext = await refreshProjectSummary({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        previousSummary: item.summary ?? "",
        newTranscriptText: cleanedText,
        templatePreset: template.preset,
        customInstructions: template.customInstructions,
      });
    } catch (e) {
      console.error("[start-transcription] summary refresh", e);
      summaryNext = item.summary ?? "";
    }

    let output_summary = "";
    let output_summary_json: unknown = null;
    let output_summary_debug: string | null = null;
    try {
      const out = await applyRecordingProcessingTemplate({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        template,
        transcriptText: cleanedText,
      });
      output_summary = out.output_summary;
      output_summary_json = out.output_summary_json;
      output_summary_debug = out.output_summary_debug;

      if (out.output_summary_json && template.preset === "tasks") {
        const validated = tasksOutputPayloadSchema.safeParse(out.output_summary_json);
        if (validated.success) {
          await insertTasksFromPayload({
            supabase,
            payload: validated.data,
            itemId: recording.item_id,
            projectId: item.project_id,
            sourceRecordingId: recordingId,
          });
        }
      }
    } catch (e) {
      console.error("[start-transcription] recording template output", e);
      const clip = cleanedText.trim().slice(0, 500);
      output_summary = `Could not generate template output (${e instanceof Error ? e.message : "error"}). Transcript preview:\n\n${clip}${cleanedText.trim().length > 500 ? "…" : ""}`;
      output_summary_json = null;
      output_summary_debug = null;
    }

    const { error: itemUpdateError } = await supabase
      .from("items")
      .update({
        master_transcript: masterTranscript,
        summary: summaryNext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recording.item_id);

    if (itemUpdateError) {
      console.error("[start-transcription] update item", itemUpdateError);
      await supabase
        .from("note_recordings")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", recordingId);
      return NextResponse.json({ error: "Failed to update item transcript" }, { status: 500 });
    }

    const { error: recordingUpdateError } = await supabase
      .from("note_recordings")
      .update({
        status: "transcribed",
        transcript_text: text,
        cleaned_transcript_text: cleanedText,
        purpose_summary: purposeSummary,
        transcription_raw: raw,
        output_summary,
        output_summary_json,
        output_summary_debug,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);

    if (recordingUpdateError) {
      console.error("[start-transcription] update recording", recordingUpdateError);
      return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
    }

    try {
      await ingestRecordingTranscriptChunks({
        supabase,
        itemId: recording.item_id,
        recordingId,
        transcriptText: cleanedText,
        openaiApiKey: env.OPENAI_API_KEY,
        openaiBaseUrl: env.OPENAI_BASE_URL,
      });
    } catch (ingestErr) {
      console.error("[start-transcription] chunk ingest", ingestErr);
    }

    try {
      await refreshOpenOutputsForItem({
        supabase,
        itemId: recording.item_id,
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        masterTranscript,
        template,
      });
    } catch (outputErr) {
      console.error("[start-transcription] output refresh", outputErr);
    }

    return NextResponse.json({
      ok: true,
      recordingId,
      status: "transcribed",
      transcriptPreview: cleanedText.slice(0, 280),
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
