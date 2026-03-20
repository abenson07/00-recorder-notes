-- note-007: project processing template + structured recording output

alter table public.projects
  add column if not exists processing_template jsonb not null default '{"preset":"summary"}'::jsonb;

alter table public.note_recordings
  add column if not exists output_summary_json jsonb;

alter table public.note_recordings
  add column if not exists output_summary_debug text;

comment on column public.projects.processing_template is
  'JSON: { preset: "summary"|"tasks", customInstructions?: string }';

comment on column public.note_recordings.output_summary_json is
  'Structured output when preset is tasks, e.g. { "tasks": [...] }';

comment on column public.note_recordings.output_summary_debug is
  'Raw model output when structured JSON validation failed';
