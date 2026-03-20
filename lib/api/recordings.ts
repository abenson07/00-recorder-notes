import type { Recording, RecordingStatus } from "@/lib/types";

export interface RecordingPollResult {
  id: string;
  status: RecordingStatus;
  transcript_text: string | null;
  output_summary: string | null;
}

/** Placeholder polling hook target; replace with GET /api/recordings/:id. */
export async function fetchRecordingStatus(
  recordingId: string,
): Promise<RecordingPollResult | null> {
  void recordingId;
  return null;
}

function stubRecording(projectId: string, recordingId: string): Recording {
  const now = new Date().toISOString();
  return {
    id: recordingId,
    project_id: projectId,
    status: "uploaded",
    audio_storage_path: `projects/${projectId}/recordings/${recordingId}/audio.webm`,
    audio_mime_type: "audio/webm",
    duration_ms: null,
    transcript_text: null,
    transcription_raw: null,
    output_summary: null,
    created_at: now,
    updated_at: now,
  };
}

/** Placeholder row — returns a stub for any ids so the recording page renders. */
export async function fetchRecording(
  projectId: string,
  recordingId: string,
): Promise<Recording | null> {
  return stubRecording(projectId, recordingId);
}
