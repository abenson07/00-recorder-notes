import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { applyRecordingProcessingTemplate } from "@/lib/openai/recordingOutput";
import { refreshProjectSummary } from "@/lib/openai/projectSummary";
import {
  OPENAI_MAX_AUDIO_BYTES,
  OpenAITranscriptionError,
  transcribeAudio,
} from "@/lib/openai/transcribe";
import { parseProcessingTemplate } from "@/lib/projects/processingTemplate";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { ingestRecordingTranscriptChunks } from "@/lib/transcripts/ingestRecordingChunks";

export const maxDuration = 300;

type SegmentRow = {
  id: string;
  position: number;
  audio_storage_path: string;
  audio_mime_type: string;
  status: string;
  transcript_text: string | null;
  transcription_raw: unknown | null;
};

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

function buildMergedRecordingTranscript(segments: SegmentRow[]): string {
  const ordered = [...segments].sort((a, b) => a.position - b.position);
  const withText = ordered.filter((s) => (s.transcript_text ?? "").trim().length > 0);
  if (withText.length === 0) {
    return "";
  }
  if (withText.length === 1) {
    return (withText[0].transcript_text ?? "").trim();
  }
  return withText
    .map(
      (s) => `\n\n[Part ${s.position}]\n${(s.transcript_text ?? "").trim()}`,
    )
    .join("")
    .trim();
}

function masterBlockForSegment(
  recordingId: string,
  position: number,
  totalSegments: number,
  segmentText: string,
): string {
  if (totalSegments === 1) {
    return `\n\n[Recording ${recordingId}]\n${segmentText}\n`;
  }
  return `\n\n[Recording ${recordingId} part ${position}]\n${segmentText}\n`;
}

async function reloadSegments(
  supabase: ReturnType<typeof createServiceRoleClient>,
  recordingId: string,
): Promise<SegmentRow[]> {
  const { data, error } = await supabase
    .from("note_recording_segments")
    .select(
      "id, position, audio_storage_path, audio_mime_type, status, transcript_text, transcription_raw",
    )
    .eq("recording_id", recordingId)
    .order("position", { ascending: true });

  if (error || !data) {
    return [];
  }
  return data as SegmentRow[];
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
      "id, project_id, status, audio_storage_path, audio_mime_type, transcript_text, transcription_raw",
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

  const { data: segmentRows, error: segLoadError } = await supabase
    .from("note_recording_segments")
    .select(
      "id, position, audio_storage_path, audio_mime_type, status, transcript_text, transcription_raw",
    )
    .eq("recording_id", recordingId)
    .order("position", { ascending: true });

  const segments = (segmentRows ?? []) as SegmentRow[];
  const useSegments = !segLoadError && segments.length > 0;

  if (useSegments) {
    return handleSegmentedTranscription({
      supabase,
      env,
      bucket,
      recordingId,
      recording,
      initialSegments: segments,
      recoveryDepth: 0,
    });
  }

  // Legacy: single file on parent row (no segment rows yet / pre-migration).
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
      .select("id, master_transcript, summary, processing_template")
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

    const template = parseProcessingTemplate(project.processing_template);

    let summaryNext = project.summary ?? "";
    try {
      summaryNext = await refreshProjectSummary({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        previousSummary: project.summary ?? "",
        newTranscriptText: text,
        templatePreset: template.preset,
        customInstructions: template.customInstructions,
      });
    } catch (e) {
      console.error("[start-transcription] summary refresh", e);
      summaryNext = project.summary ?? "";
    }

    let output_summary = "";
    let output_summary_json: unknown = null;
    let output_summary_debug: string | null = null;
    try {
      const out = await applyRecordingProcessingTemplate({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        template,
        transcriptText: text,
      });
      output_summary = out.output_summary;
      output_summary_json = out.output_summary_json;
      output_summary_debug = out.output_summary_debug;
    } catch (e) {
      console.error("[start-transcription] recording template output", e);
      const clip = text.trim().slice(0, 500);
      output_summary = `Could not generate template output (${e instanceof Error ? e.message : "error"}). Transcript preview:\n\n${clip}${text.trim().length > 500 ? "…" : ""}`;
      output_summary_json = null;
      output_summary_debug = null;
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
        projectId: recording.project_id,
        recordingId,
        transcriptText: text,
        openaiApiKey: env.OPENAI_API_KEY,
        openaiBaseUrl: env.OPENAI_BASE_URL,
      });
    } catch (ingestErr) {
      console.error("[start-transcription] chunk ingest", ingestErr);
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

async function handleSegmentedTranscription({
  supabase,
  env,
  bucket,
  recordingId,
  recording,
  initialSegments,
  recoveryDepth = 0,
}: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  env: ReturnType<typeof getServerEnv>;
  bucket: string;
  recordingId: string;
  recording: {
    id: string;
    project_id: string;
    status: string;
    audio_storage_path: string;
    audio_mime_type: string;
    transcript_text: string | null;
    transcription_raw: unknown | null;
  };
  initialSegments: SegmentRow[];
  /** Used to recover when segments are stuck in `transcription_pending` (timeout/crash). */
  recoveryDepth?: number;
}) {
  let segments = initialSegments;
  const recoverNow = new Date().toISOString();
  if (recording.status === "failed") {
    await supabase
      .from("note_recording_segments")
      .update({ status: "uploaded", updated_at: recoverNow })
      .eq("recording_id", recordingId)
      .eq("status", "transcription_pending");
    segments = await reloadSegments(supabase, recordingId);
  }

  const totalSegmentCount = segments.length;

  const needsWork = (s: SegmentRow) => s.status === "uploaded" || s.status === "failed";

  const allTranscribed = segments.every((s) => s.status === "transcribed");

  if (
    allTranscribed &&
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

  const workQueue = [...segments]
    .filter(needsWork)
    .sort((a, b) => a.position - b.position);

  if (allTranscribed && workQueue.length === 0) {
    const merged = buildMergedRecordingTranscript(segments);
    const first = segments[0];
    await supabase
      .from("note_recordings")
      .update({
        status: "transcribed",
        transcript_text: merged || recording.transcript_text,
        audio_storage_path: first?.audio_storage_path ?? recording.audio_storage_path,
        audio_mime_type: first?.audio_mime_type ?? recording.audio_mime_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);

    return NextResponse.json({
      ok: true,
      idempotent: true,
      recordingId,
      status: "transcribed",
      transcriptPreview: (merged || recording.transcript_text || "").slice(0, 280),
    });
  }

  if (workQueue.length === 0 && !allTranscribed) {
    const stuckInPending = segments.some((s) => s.status === "transcription_pending");
    if (stuckInPending && recoveryDepth < 2) {
      const staleBefore = new Date(Date.now() - 90_000).toISOString();
      const { data: resetRows, error: resetErr } = await supabase
        .from("note_recording_segments")
        .update({ status: "uploaded", updated_at: new Date().toISOString() })
        .eq("recording_id", recordingId)
        .eq("status", "transcription_pending")
        .lt("updated_at", staleBefore)
        .select("id");
      if (resetErr) {
        console.error("[start-transcription] reset stuck pending", resetErr);
      }
      if (resetRows && resetRows.length > 0) {
        const reloaded = await reloadSegments(supabase, recordingId);
        const { data: recFresh, error: rfErr } = await supabase
          .from("note_recordings")
          .select(
            "id, project_id, status, audio_storage_path, audio_mime_type, transcript_text, transcription_raw",
          )
          .eq("id", recordingId)
          .maybeSingle();
        if (rfErr || !recFresh) {
          console.error("[start-transcription] reload recording after pending reset", rfErr);
          return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
        }
        return handleSegmentedTranscription({
          supabase,
          env,
          bucket,
          recordingId,
          recording: recFresh as typeof recording,
          initialSegments: reloaded,
          recoveryDepth: recoveryDepth + 1,
        });
      }
      return NextResponse.json({
        ok: true,
        recordingId,
        status: "transcription_pending",
        stillPending: true,
      });
    }
    console.error("[start-transcription] inconsistent segments", {
      recordingId,
      recoveryDepth,
      segmentStatuses: segments.map((s) => ({ id: s.id, position: s.position, status: s.status })),
    });
    await supabase
      .from("note_recordings")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        transcription_raw: {
          error: "Segment state inconsistent; reset segments or retry.",
          code: "SEGMENT_STUCK",
        },
      })
      .eq("id", recordingId);
    return NextResponse.json(
      {
        error: "Recording segments are in an inconsistent state. Try Retry transcription.",
        code: "SEGMENT_STUCK",
      },
      { status: 500 },
    );
  }

  const now = new Date().toISOString();

  if (recording.status === "uploaded" || recording.status === "failed") {
    const { data: claimed, error: pendingErr } = await supabase
      .from("note_recordings")
      .update({ status: "transcription_pending", updated_at: now })
      .eq("id", recordingId)
      .in("status", ["uploaded", "failed"])
      .select("id");

    if (pendingErr) {
      console.error("[start-transcription] set pending (segmented)", pendingErr);
      return NextResponse.json({ error: "Failed to update recording" }, { status: 500 });
    }

    if (!claimed?.length) {
      const { data: again } = await supabase
        .from("note_recordings")
        .select("id, status, transcript_text")
        .eq("id", recordingId)
        .maybeSingle();
      if (
        again?.status === "transcribed" &&
        again.transcript_text &&
        again.transcript_text.length > 0
      ) {
        return NextResponse.json({
          ok: true,
          idempotent: true,
          recordingId: again.id,
          status: again.status,
          transcriptPreview: again.transcript_text.slice(0, 280),
        });
      }
    }
  } else if (recording.status === "transcribed") {
    await supabase
      .from("note_recordings")
      .update({ status: "transcription_pending", updated_at: now })
      .eq("id", recordingId);
  } else if (recording.status !== "transcription_pending") {
    return NextResponse.json(
      { error: `Cannot start transcription from status: ${recording.status}` },
      { status: 409 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, master_transcript, summary, processing_template")
    .eq("id", recording.project_id)
    .maybeSingle();

  if (projectError || !project) {
    console.error("[start-transcription] load project (segmented)", projectError);
    await supabase
      .from("note_recordings")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", recordingId);
    return NextResponse.json({ error: "Project not found" }, { status: 500 });
  }

  let masterTranscript = (project.master_transcript ?? "").trimEnd();
  let summaryNext = project.summary ?? "";
  const template = parseProcessingTemplate(project.processing_template);

  try {
    for (const seg of workQueue) {
      const { data: claimedSeg, error: claimErr } = await supabase
        .from("note_recording_segments")
        .update({ status: "transcription_pending", updated_at: new Date().toISOString() })
        .eq("id", seg.id)
        .in("status", ["uploaded", "failed"])
        .select("id");

      if (claimErr || !claimedSeg?.length) {
        segments = await reloadSegments(supabase, recordingId);
        continue;
      }

      const { data: storageBlob, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(seg.audio_storage_path);

      if (downloadError || !storageBlob) {
        console.error("[start-transcription] segment storage download", downloadError);
        await supabase
          .from("note_recording_segments")
          .update({
            status: "failed",
            transcription_raw: { error: "STORAGE_DOWNLOAD", segmentId: seg.id },
            updated_at: new Date().toISOString(),
          })
          .eq("id", seg.id);
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
          .from("note_recording_segments")
          .update({
            status: "failed",
            transcription_raw: {
              error: "AUDIO_TOO_LARGE",
              maxBytes: OPENAI_MAX_AUDIO_BYTES,
              actualBytes: byteSize,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", seg.id);
        await supabase
          .from("note_recordings")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
            transcription_raw: {
              error: "AUDIO_TOO_LARGE",
              segmentId: seg.id,
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
        seg.audio_storage_path,
        seg.audio_mime_type || storageBlob.type || "application/octet-stream",
      );

      let text: string;
      let raw: unknown;
      try {
        const out = await transcribeAudio({
          apiKey: env.OPENAI_API_KEY,
          baseUrl: env.OPENAI_BASE_URL,
          audio: storageBlob,
          filename: fileName,
        });
        text = out.text;
        raw = out.raw;
      } catch (segErr) {
        if (segErr instanceof OpenAITranscriptionError) {
          await supabase
            .from("note_recording_segments")
            .update({
              status: "failed",
              transcription_raw: {
                error: segErr.message,
                code: segErr.code,
                status: segErr.status,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", seg.id);
          await supabase
            .from("note_recordings")
            .update({
              status: "failed",
              updated_at: new Date().toISOString(),
              transcription_raw: {
                error: segErr.message,
                code: segErr.code,
                segmentId: seg.id,
              },
            })
            .eq("id", recordingId);
          const st =
            segErr.status >= 400 && segErr.status < 600 ? segErr.status : 502;
          return NextResponse.json(
            { error: segErr.message, code: segErr.code ?? "OPENAI_ERROR" },
            { status: st === 401 || st === 413 || st === 429 ? st : 502 },
          );
        }
        throw segErr;
      }

      await supabase
        .from("note_recording_segments")
        .update({
          status: "transcribed",
          transcript_text: text,
          transcription_raw: raw,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seg.id);

      const block = masterBlockForSegment(recordingId, seg.position, totalSegmentCount, text);
      masterTranscript += block;

      try {
        summaryNext = await refreshProjectSummary({
          apiKey: env.OPENAI_API_KEY,
          baseUrl: env.OPENAI_BASE_URL,
          previousSummary: summaryNext,
          newTranscriptText: text,
          templatePreset: template.preset,
          customInstructions: template.customInstructions,
        });
      } catch (e) {
        console.error("[start-transcription] summary refresh (segment)", e);
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
        console.error("[start-transcription] update project (segment)", projectUpdateError);
        await supabase
          .from("note_recordings")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", recordingId);
        return NextResponse.json({ error: "Failed to update project transcript" }, { status: 500 });
      }

      segments = await reloadSegments(supabase, recordingId);
    }

    const merged = buildMergedRecordingTranscript(segments);
    let output_summary = "";
    let output_summary_json: unknown = null;
    let output_summary_debug: string | null = null;
    try {
      const out = await applyRecordingProcessingTemplate({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        template,
        transcriptText: merged,
      });
      output_summary = out.output_summary;
      output_summary_json = out.output_summary_json;
      output_summary_debug = out.output_summary_debug;
    } catch (e) {
      console.error("[start-transcription] recording template output (merged)", e);
      const clip = merged.trim().slice(0, 500);
      output_summary = `Could not generate template output (${e instanceof Error ? e.message : "error"}). Transcript preview:\n\n${clip}${merged.trim().length > 500 ? "…" : ""}`;
      output_summary_json = null;
      output_summary_debug = null;
    }

    const first = segments[0];
    const { error: recordingUpdateError } = await supabase
      .from("note_recordings")
      .update({
        status: "transcribed",
        transcript_text: merged,
        transcription_raw: null,
        output_summary,
        output_summary_json,
        output_summary_debug,
        audio_storage_path: first?.audio_storage_path ?? recording.audio_storage_path,
        audio_mime_type: first?.audio_mime_type ?? recording.audio_mime_type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordingId);

    if (recordingUpdateError) {
      console.error("[start-transcription] update recording (merged)", recordingUpdateError);
      return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
    }

    try {
      await ingestRecordingTranscriptChunks({
        supabase,
        projectId: recording.project_id,
        recordingId,
        transcriptText: merged,
        openaiApiKey: env.OPENAI_API_KEY,
        openaiBaseUrl: env.OPENAI_BASE_URL,
      });
    } catch (ingestErr) {
      console.error("[start-transcription] chunk ingest (merged)", ingestErr);
    }

    return NextResponse.json({
      ok: true,
      recordingId,
      status: "transcribed",
      transcriptPreview: merged.slice(0, 280),
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

    console.error("[start-transcription] segmented", e);
    await supabase
      .from("note_recordings")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", recordingId);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
