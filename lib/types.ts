export type RecordingStatus =
  | "uploaded"
  | "transcription_pending"
  | "transcribed"
  | "failed";

export type TranscriptionJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export interface Project {
  id: string;
  title: string;
  description: string | null;
  direction_files: unknown | null;
  title_locked: boolean;
  master_transcript: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  project_id: string | null;
  status: RecordingStatus;
  audio_storage_path: string;
  audio_mime_type: string;
  duration_ms: number | null;
  transcript_text: string | null;
  transcription_raw: unknown | null;
  output_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordingsSummary {
  total: number;
  transcribed: number;
  pending: number;
}

/** List row from GET /api/projects/:id/recordings */
export interface RecordingListItem {
  id: string;
  status: RecordingStatus;
  created_at: string;
  preview: string | null;
}
