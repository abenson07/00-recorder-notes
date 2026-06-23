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

/** Stored as JSON on `items.processing_template`; see `lib/projects/processingTemplate.ts`. */
export type ItemProcessingTemplate = {
  preset: "summary" | "tasks";
  customInstructions?: string | null;
};

/** @deprecated Use ItemProcessingTemplate */
export type ProjectProcessingTemplate = ItemProcessingTemplate;

export interface Context {
  id: string;
  slug: string;
  title: string;
  content_md: string;
  created_at: string;
  updated_at: string;
}

/** Parent project — groups items. */
export interface Project {
  id: string;
  title: string;
  description: string | null;
  context_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Item — container for sequential recordings/files (formerly `projects` table). */
export interface Item {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  direction_files: unknown | null;
  title_locked: boolean;
  master_transcript: string;
  summary: string;
  /** JSON from DB; parse with `parseProcessingTemplate` when needed. */
  processing_template?: ItemProcessingTemplate | unknown | null;
  created_at: string;
  updated_at: string;
}

export interface Output {
  id: string;
  scope_type: "item" | "project";
  scope_id: string;
  title: string;
  content_md: string;
  locked: boolean;
  output_type: "summary" | "tasks" | "custom";
  created_at: string;
  updated_at: string;
}

export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  item_id: string | null;
  project_id: string | null;
  source_recording_id: string | null;
  title: string;
  details: string | null;
  priority: TaskPriority | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  item_id: string | null;
  status: RecordingStatus;
  audio_storage_path: string;
  audio_mime_type: string;
  duration_ms: number | null;
  transcript_text: string | null;
  cleaned_transcript_text: string | null;
  purpose_summary: string | null;
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

/** List row from GET /api/items/:id/recordings */
export interface RecordingListItem {
  id: string;
  status: RecordingStatus;
  created_at: string;
  preview: string | null;
}

/** List row for items on home / project views. */
export interface ItemListRow {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  project_title: string | null;
  updated_at: string;
  master_transcript_preview: string;
  recordings_count: number;
}
