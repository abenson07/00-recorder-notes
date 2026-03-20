-- note-001: projects, recordings, transcription_jobs + RLS (no anon policies)
-- Apply via Supabase SQL editor or `supabase db push` when linked.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text,
  direction_files jsonb,
  title_locked boolean not null default false,
  master_transcript text not null default '',
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete cascade,
  status text not null,
  audio_storage_path text not null,
  audio_mime_type text not null default 'audio/webm',
  duration_ms bigint,
  transcript_text text,
  transcription_raw jsonb,
  output_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recordings_status_check check (
    status in (
      'uploaded',
      'transcription_pending',
      'transcribed',
      'failed'
    )
  )
);

create table if not exists public.transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  external_job_id text,
  status text not null,
  result_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transcription_jobs_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed')
  )
);

create unique index if not exists transcription_jobs_external_job_id_unique
  on public.transcription_jobs (external_job_id)
  where external_job_id is not null;

create index if not exists recordings_project_id_created_at_desc
  on public.recordings (project_id, created_at desc);

create index if not exists transcription_jobs_recording_id
  on public.transcription_jobs (recording_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute procedure public.set_updated_at();

drop trigger if exists recordings_set_updated_at on public.recordings;
create trigger recordings_set_updated_at
  before update on public.recordings
  for each row
  execute procedure public.set_updated_at();

drop trigger if exists transcription_jobs_set_updated_at on public.transcription_jobs;
create trigger transcription_jobs_set_updated_at
  before update on public.transcription_jobs
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: enabled; no policies for anon/authenticated → no direct client access.
-- Service role bypasses RLS for server-side Next.js routes.
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.recordings enable row level security;
alter table public.transcription_jobs enable row level security;

-- Storage: keep bucket private in Dashboard; do not add public read policies.
-- Signed upload/read URLs are created with the service role from Next.js.
