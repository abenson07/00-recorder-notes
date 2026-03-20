-- note-006: include recording_id in global chunk match (navigation to recording pages)

drop function if exists public.match_global_chunks(vector(1536), int);

create function public.match_global_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  project_id uuid,
  recording_id uuid,
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
    c.recording_id,
    c.chunk_text,
    c.metadata,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.transcript_embeddings e
  inner join public.transcript_chunks c on c.id = e.chunk_id
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

grant execute on function public.match_global_chunks(vector(1536), int) to service_role;
