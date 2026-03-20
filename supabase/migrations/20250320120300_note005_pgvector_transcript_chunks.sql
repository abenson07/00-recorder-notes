-- note-005: pgvector + transcript chunk storage + similarity search RPCs

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.transcript_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  recording_id uuid references public.note_recordings (id) on delete cascade,
  source_type text not null,
  chunk_text text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint transcript_chunks_source_type_check check (
    source_type in ('master_transcript', 'recording_transcript')
  )
);

create table if not exists public.transcript_embeddings (
  id uuid primary key default gen_random_uuid(),
  chunk_id uuid not null references public.transcript_chunks (id) on delete cascade,
  embedding vector(1536) not null,
  created_at timestamptz not null default now(),
  constraint transcript_embeddings_chunk_id_unique unique (chunk_id)
);

create index if not exists transcript_chunks_project_id_created_at
  on public.transcript_chunks (project_id, created_at);

create index if not exists transcript_chunks_recording_id
  on public.transcript_chunks (recording_id)
  where recording_id is not null;

-- Cosine similarity search (OpenAI text-embedding-3-small default dimension)
create index if not exists transcript_embeddings_embedding_hnsw
  on public.transcript_embeddings
  using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Match RPCs (service_role from Next.js)
-- ---------------------------------------------------------------------------

create or replace function public.match_project_chunks(
  query_embedding vector(1536),
  match_project_id uuid,
  match_count int default 8
)
returns table (
  chunk_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
)
language sql
stable
parallel safe
as $$
  select
    c.id as chunk_id,
    c.chunk_text,
    c.metadata,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.transcript_embeddings e
  inner join public.transcript_chunks c on c.id = e.chunk_id
  where c.project_id = match_project_id
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

create or replace function public.match_global_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  project_id uuid,
  chunk_text text,
  metadata jsonb,
  similarity float
)
language sql
stable
parallel safe
as $$
  select
    c.id as chunk_id,
    c.project_id,
    c.chunk_text,
    c.metadata,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.transcript_embeddings e
  inner join public.transcript_chunks c on c.id = e.chunk_id
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.transcript_chunks to service_role;
grant select, insert, update, delete on table public.transcript_embeddings to service_role;

grant execute on function public.match_project_chunks(vector(1536), uuid, int) to service_role;
grant execute on function public.match_global_chunks(vector(1536), int) to service_role;
