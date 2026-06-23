-- note-008: projects-as-items hierarchy + contexts, outputs, tasks

-- ---------------------------------------------------------------------------
-- Step 1: Rename projects → items (existing rows become unsorted items)
-- ---------------------------------------------------------------------------

alter table public.projects rename to items;

alter table public.note_recordings rename column project_id to item_id;

alter table public.transcript_chunks rename column project_id to item_id;

-- Rename indexes / triggers referencing old table name
alter index if exists note_recordings_project_id_created_at_desc
  rename to note_recordings_item_id_created_at_desc;

alter index if exists transcript_chunks_project_id_created_at
  rename to transcript_chunks_item_id_created_at;

drop trigger if exists projects_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 2: Contexts (must exist before projects FK)
-- ---------------------------------------------------------------------------

create table if not exists public.contexts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null default '',
  content_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contexts_slug_unique unique (slug)
);

drop trigger if exists contexts_set_updated_at on public.contexts;
create trigger contexts_set_updated_at
  before update on public.contexts
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 3: New parent projects table
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text,
  context_id uuid references public.contexts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 4: Link items to parent projects
-- ---------------------------------------------------------------------------

alter table public.items
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists items_project_id_updated_at_desc
  on public.items (project_id, updated_at desc)
  where project_id is not null;

-- ---------------------------------------------------------------------------
-- Step 5: Recording enhancements
-- ---------------------------------------------------------------------------

alter table public.note_recordings
  add column if not exists cleaned_transcript_text text;

alter table public.note_recordings
  add column if not exists purpose_summary text;

-- ---------------------------------------------------------------------------
-- Step 6: Outputs
-- ---------------------------------------------------------------------------

create table if not exists public.outputs (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  scope_id uuid not null,
  title text not null default '',
  content_md text not null default '',
  locked boolean not null default false,
  output_type text not null default 'custom',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outputs_scope_type_check check (scope_type in ('item', 'project')),
  constraint outputs_output_type_check check (
    output_type in ('summary', 'tasks', 'custom')
  )
);

create index if not exists outputs_scope on public.outputs (scope_type, scope_id);

drop trigger if exists outputs_set_updated_at on public.outputs;
create trigger outputs_set_updated_at
  before update on public.outputs
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 7: Tasks
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  source_recording_id uuid references public.note_recordings (id) on delete set null,
  title text not null,
  details text,
  priority text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_priority_check check (
    priority is null or priority in ('low', 'medium', 'high')
  )
);

create index if not exists tasks_incomplete on public.tasks (completed_at)
  where completed_at is null;

create index if not exists tasks_item_id on public.tasks (item_id);

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 8: Update pgvector RPCs (project_id → item_id)
-- ---------------------------------------------------------------------------

drop function if exists public.match_project_chunks(vector(1536), uuid, int);

create or replace function public.match_item_chunks(
  query_embedding vector(1536),
  match_item_id uuid,
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
  where c.item_id = match_item_id
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

-- Backward-compatible alias
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
  select * from public.match_item_chunks(query_embedding, match_project_id, match_count);
$$;

drop function if exists public.match_global_chunks(vector(1536), int);

create function public.match_global_chunks(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  chunk_id uuid,
  item_id uuid,
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
    c.item_id,
    c.recording_id,
    c.chunk_text,
    c.metadata,
    (1 - (e.embedding <=> query_embedding))::float as similarity
  from public.transcript_embeddings e
  inner join public.transcript_chunks c on c.id = e.chunk_id
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

grant execute on function public.match_item_chunks(vector(1536), uuid, int) to service_role;
grant execute on function public.match_project_chunks(vector(1536), uuid, int) to service_role;
grant execute on function public.match_global_chunks(vector(1536), int) to service_role;

-- ---------------------------------------------------------------------------
-- Step 9: Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.contexts to service_role;
grant select, insert, update, delete on table public.outputs to service_role;
grant select, insert, update, delete on table public.tasks to service_role;

-- items table already had grants from projects rename; ensure projects table too
grant select, insert, update, delete on table public.projects to service_role;
