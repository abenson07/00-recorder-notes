import { createClient } from "@/utils/supabase/client";

export type CreateRecordingResponse = {
  recordingId: string;
  itemId: string;
  audioStoragePath: string;
  storageBucket: string;
  signedUpload: {
    signedUrl: string;
    token: string;
    path: string;
  };
};

export async function createRecordingWithUploadInstructions(
  itemId: string,
  audioMimeType: string,
  sourceFilename?: string,
): Promise<CreateRecordingResponse> {
  const res = await fetch(`/api/items/${itemId}/recordings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioMimeType,
      ...(sourceFilename ? { sourceFilename } : {}),
    }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok || typeof data !== "object" || data === null) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not start recording upload";
    throw new Error(msg);
  }
  const d = data as CreateRecordingResponse;
  if (!d.recordingId || !d.signedUpload?.token || !d.signedUpload?.path || !d.storageBucket) {
    throw new Error("Invalid upload instructions from server");
  }
  return d;
}

export async function uploadRecordingBlob(
  instructions: CreateRecordingResponse,
  blob: Blob,
  audioMimeType: string,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(instructions.storageBucket)
    .uploadToSignedUrl(
      instructions.signedUpload.path,
      instructions.signedUpload.token,
      blob,
      { contentType: audioMimeType, upsert: true },
    );

  if (error) {
    throw new Error(error.message || "Upload failed");
  }
}

export const OPENAI_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
