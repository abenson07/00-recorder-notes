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

/** Stored as JSON on `projects.processing_template`; see `lib/projects/processingTemplate.ts`. */
export type ProjectProcessingTemplate = {
  preset: "summary" | "tasks";
  customInstructions?: string | null;
};

export interface Project {
  id: string;
  title: string;
  description: string | null;
  direction_files: unknown | null;
  title_locked: boolean;
  master_transcript: string;
  summary: string;
  /** JSON from DB; parse with `parseProcessingTemplate` when needed. */
  processing_template?: ProjectProcessingTemplate | unknown | null;
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
  /** Tasks template payload, e.g. `{ tasks: [...] }`. */
  output_summary_json?: unknown | null;
  /** Raw model output when JSON validation failed. */
  output_summary_debug?: string | null;
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
