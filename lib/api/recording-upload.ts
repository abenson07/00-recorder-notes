import { createClient } from "@/utils/supabase/client";

export type CreateRecordingResponse = {
  recordingId: string;
  audioStoragePath: string;
  storageBucket: string;
  signedUpload: {
    signedUrl: string;
    token: string;
    path: string;
  };
};

export type CreateSegmentResponse = {
  recordingId: string;
  segmentId: string;
  position: number;
  audioStoragePath: string;
  storageBucket: string;
  signedUpload: {
    signedUrl: string;
    token: string;
    path: string;
  };
};

export async function createRecordingWithUploadInstructions(
  projectId: string,
  audioMimeType: string,
): Promise<CreateRecordingResponse> {
  const res = await fetch(`/api/projects/${projectId}/recordings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioMimeType }),
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

export async function createSegmentWithUploadInstructions(
  recordingId: string,
  projectId: string,
  audioMimeType: string,
): Promise<CreateSegmentResponse> {
  const qs = new URLSearchParams({ projectId });
  const res = await fetch(
    `/api/recordings/${encodeURIComponent(recordingId)}/segments?${qs.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioMimeType }),
    },
  );
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok || typeof data !== "object" || data === null) {
    const msg =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Could not start segment upload";
    throw new Error(msg);
  }
  const d = data as CreateSegmentResponse;
  if (
    !d.recordingId ||
    !d.segmentId ||
    !d.signedUpload?.token ||
    !d.signedUpload?.path ||
    !d.storageBucket
  ) {
    throw new Error("Invalid segment upload instructions from server");
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

export async function uploadSegmentBlob(
  instructions: CreateSegmentResponse,
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
