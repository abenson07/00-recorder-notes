import { getServerEnv } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

/** Object key segment matches `note-000` convention: `…/audio.webm`. */
const RECORDING_AUDIO_OBJECT_NAME = "audio.webm";

/**
 * Deterministic storage path for a recording’s audio object.
 * Parameter order matches `tasks/note-001.md`.
 */
export function getRecordingObjectPath(recordingId: string, projectId: string): string {
  return `projects/${projectId}/recordings/${recordingId}/${RECORDING_AUDIO_OBJECT_NAME}`;
}

export interface SignedUploadPayload {
  signedUrl: string;
  token: string;
  path: string;
}

/** Signed upload URL + token for client `uploadToSignedUrl` / PUT flows. */
export async function createRecordingSignedUpload(
  recordingId: string,
  projectId: string,
): Promise<SignedUploadPayload> {
  const env = getServerEnv();
  const supabase = createServiceRoleClient();
  const objectPath = getRecordingObjectPath(recordingId, projectId);
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET_AUDIO)
    .createSignedUploadUrl(objectPath, { upsert: true });

  if (error || !data) {
    throw new Error(
      error?.message ?? "Could not create signed upload URL for recording audio",
    );
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/** Time-limited URL for playback or server-side fetch (transcription uses direct download). */
export async function createSignedAudioReadUrl(
  audioStoragePath: string,
  expiresInSeconds: number,
): Promise<string> {
  const env = getServerEnv();
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET_AUDIO)
    .createSignedUrl(audioStoragePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create signed read URL for recording audio");
  }

  return data.signedUrl;
}
