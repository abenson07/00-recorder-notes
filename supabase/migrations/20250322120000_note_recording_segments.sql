-- Multi-segment recordings: ordered audio files per note_recordings row.

create table if not exists public.note_recording_segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.note_recordings (id) on delete cascade,
  position int not null,
  audio_storage_path text not null,
  audio_mime_type text not null default 'audio/webm',
  duration_ms bigint,
  status text not null,
  transcript_text text,
  transcription_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint note_recording_segments_position_non_negative check (position >= 0),
  constraint note_recording_segments_status_check check (
    status in (
      'uploaded',
      'transcription_pending',
      'transcribed',
      'failed'
    )
  ),
  constraint note_recording_segments_recording_id_position_unique unique (recording_id, position)
);

create index if not exists note_recording_segments_recording_id_position
  on public.note_recording_segments (recording_id, position);

drop trigger if exists note_recording_segments_set_updated_at on public.note_recording_segments;
create trigger note_recording_segments_set_updated_at
  before update on public.note_recording_segments
  for each row
  execute procedure public.set_updated_at();

alter table public.note_recording_segments enable row level security;

grant select, insert, update, delete on table public.note_recording_segments to service_role;

-- Backfill: one segment per existing recording (position 0), mirroring parent row.
insert into public.note_recording_segments (
  recording_id,
  position,
  audio_storage_path,
  audio_mime_type,
  duration_ms,
  status,
  transcript_text,
  transcription_raw
)
select
  r.id,
  0,
  r.audio_storage_path,
  r.audio_mime_type,
  r.duration_ms,
  r.status,
  r.transcript_text,
  r.transcription_raw
from public.note_recordings r
where not exists (
  select 1
  from public.note_recording_segments s
  where s.recording_id = r.id
);
