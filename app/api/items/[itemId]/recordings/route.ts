import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { getServerEnv } from "@/lib/env";
import { createRecordingSignedUpload, getRecordingObjectPath } from "@/lib/supabase/storage";

const itemIdSchema = z.uuid();

const postBodySchema = z.object({
  audioMimeType: z.string().max(200).optional(),
  sourceFilename: z.string().max(500).optional(),
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
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId: rawItemId } = await context.params;
  const idParse = itemIdSchema.safeParse(rawItemId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 404 });
  }
  const itemId = idParse.data;

  try {
    const supabase = createServiceRoleClient();
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      console.error("[GET .../recordings] item", itemError);
      return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
    }

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from("note_recordings")
      .select("id, status, created_at, transcript_text, output_summary")
      .eq("item_id", itemId)
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
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId: rawItemId } = await context.params;
  const idParse = itemIdSchema.safeParse(rawItemId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 404 });
  }
  const itemId = idParse.data;

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
  const audioStoragePath = getRecordingObjectPath(recordingId, itemId);

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();

    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id, title, title_locked")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      console.error("[POST .../recordings] item", itemError);
      return NextResponse.json({ error: "Failed to validate item" }, { status: 500 });
    }

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const { error: insertError } = await supabase.from("note_recordings").insert({
      id: recordingId,
      item_id: itemId,
      status: "uploaded",
      audio_storage_path: audioStoragePath,
      audio_mime_type: audioMimeType,
    });

    if (insertError) {
      console.error("[POST .../recordings] insert", insertError);
      return NextResponse.json({ error: "Failed to create recording" }, { status: 500 });
    }

    if (
      parsed.data.sourceFilename &&
      !item.title?.trim() &&
      !item.title_locked
    ) {
      const nameFromFile = parsed.data.sourceFilename
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim()
        .slice(0, 200);
      if (nameFromFile) {
        await supabase
          .from("items")
          .update({ title: nameFromFile, updated_at: new Date().toISOString() })
          .eq("id", itemId);
      }
    }

    let signedUpload;
    try {
      signedUpload = await createRecordingSignedUpload(recordingId, itemId);
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
        itemId,
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
