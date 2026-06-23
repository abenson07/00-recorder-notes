import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import {
  applyRecordingProcessingTemplate,
  tasksOutputPayloadSchema,
} from "@/lib/openai/recordingOutput";
import { parseProcessingTemplate } from "@/lib/projects/processingTemplate";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { insertTasksFromPayload } from "@/lib/tasks/insertTasks";

const bodySchema = z.object({
  recordingId: z.string().uuid(),
});

/** Extract tasks from an already-transcribed recording and insert into tasks table. */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { recordingId } = parsed.data;

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();

    const { data: recording, error: recErr } = await supabase
      .from("note_recordings")
      .select("id, item_id, status, transcript_text, cleaned_transcript_text, output_summary_json")
      .eq("id", recordingId)
      .maybeSingle();

    if (recErr) {
      console.error("[POST /api/tasks/extract]", recErr);
      return NextResponse.json({ error: "Failed to load recording" }, { status: 500 });
    }

    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    if (recording.status !== "transcribed") {
      return NextResponse.json(
        { error: "Recording must be transcribed before extracting tasks", code: "NOT_TRANSCRIBED" },
        { status: 409 },
      );
    }

    const transcript =
      recording.cleaned_transcript_text?.trim() ||
      recording.transcript_text?.trim() ||
      "";

    let payload = tasksOutputPayloadSchema.safeParse(recording.output_summary_json);

    if (!payload.success) {
      const template = parseProcessingTemplate({ preset: "tasks" });
      const out = await applyRecordingProcessingTemplate({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        template,
        transcriptText: transcript,
      });
      payload = tasksOutputPayloadSchema.safeParse(out.output_summary_json);
      if (!payload.success) {
        return NextResponse.json(
          { error: "Could not extract tasks from recording", code: "EXTRACT_FAILED" },
          { status: 422 },
        );
      }
    }

    let projectId: string | null = null;
    if (recording.item_id) {
      const { data: item } = await supabase
        .from("items")
        .select("project_id")
        .eq("id", recording.item_id)
        .maybeSingle();
      projectId = item?.project_id ?? null;
    }

    const count = await insertTasksFromPayload({
      supabase,
      payload: payload.data,
      itemId: recording.item_id,
      projectId,
      sourceRecordingId: recordingId,
    });

    return NextResponse.json({ ok: true, tasksCreated: count });
  } catch (e) {
    console.error("[POST /api/tasks/extract]", e);
    return NextResponse.json({ error: "Task extraction failed" }, { status: 500 });
  }
}
