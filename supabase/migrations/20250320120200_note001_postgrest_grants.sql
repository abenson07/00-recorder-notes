-- PostgREST (Data API): grant privileges so requests signed with the service_role
-- JWT can read/write these tables. Without this, the API returns HTTP 403 / Postgres
-- 42501 "permission denied for table …" even when the key is correct.
--
-- Run in SQL Editor if you already applied note-001 core schema before this file existed.

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.projects to service_role;
grant select, insert, update, delete on table public.note_recordings to service_role;
grant select, insert, update, delete on table public.transcription_jobs to service_role;
