-- Optional: turn off RLS on note-001 tables.
-- Warning: combined with broad GRANTs, anon/authenticated clients could read/write
-- via the Data API. Prefer keeping RLS enabled and using the service role from Next.js.

alter table if exists public.projects disable row level security;
alter table if exists public.note_recordings disable row level security;
alter table if exists public.transcription_jobs disable row level security;
