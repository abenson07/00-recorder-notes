## note-000 — Framework Setup, Scaffolding, and System Architecture

### Prerequisites
1. `note-recording-app/tasks/human-tasks.md` completed (Supabase project + Storage, **OpenAI** API key, `.env.local` — see `.env.example`).

### Detailed Implementation Steps
#### A) Scaffold the Next.js web app (desktop-first)
1. From `/Users/alexbenson/Personal Builder Day/note-recording-app`, scaffold a Next.js app using the App Router:
   - Recommended: TypeScript + ESLint + Tailwind (or your preferred styling)
   - Example (adjust to your preferred package manager):
     - `npx create-next-app@latest . --ts --app --eslint --tailwind`
2. Decide conventions up-front:
   - Use the Next.js App Router (`app/` directory)
   - Use `route.ts` Route Handlers for APIs
   - Prefer `lib/` for server helpers (Supabase / OpenAI) and `components/` for UI
3. Add baseline dependencies (only what you need in v1):
   - `@tanstack/react-query`
   - `@supabase/supabase-js`
   - (Optional) `zustand` for recording UI state
   - (Optional) `zod` for request validation
4. Configure environment variables:
   - Create `note-recording-app/.env.local` with (names match `lib/env.ts`):
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_STORAGE_BUCKET_AUDIO` (default bucket name used in docs: **`recordings`**)
     - `OPENAI_API_KEY` (server-only)
     - (optional) `OPENAI_BASE_URL` — defaults to `https://api.openai.com/v1`
5. Add a runtime config helper:
   - Create a small module (for example `lib/env.ts`) that reads env vars and throws a helpful error in dev if missing.

#### B) Establish app routes and a minimal UI skeleton
1. Create pages/routes:
   - `app/page.tsx` (Main List View)
   - `app/projects/[projectId]/page.tsx` (Project Detail)
   - `app/projects/[projectId]/recordings/[recordingId]/page.tsx` (Individual Recording)
2. Add a lightweight design baseline:
   - An “Empty state” with centered record button on `app/page.tsx`
   - A bottom floating record button on list screens when at least one project exists
3. Add placeholder UI components (stubs are OK at this stage):
   - `components/record/RecordButton`
   - `components/record/WaveformRecorder` (stub)
   - `components/record/RecordingTransportControls` (stub)
   - `components/projects/ProjectList` and `ProjectCard`
   - `components/projects/ProjectTabs` and `components/text/SearchableTextPane` (stub)
   - `components/playback/AudioPlayer` (stub)
   - `components/chat/ChatPanel` (stub)

#### C) Add React Query provider and server polling plumbing (structure only)
1. Add a `QueryClientProvider` at the root (usually `app/layout.tsx`).
2. Create typed client helpers (without calling real DB yet):
   - `lib/api/projects.ts` (stubs returning placeholder data)
   - `lib/api/recordings.ts` (stubs for polling endpoints)

#### D) Define core system architecture (the full plan)
The following describes the intended implementation for data flow, API surface, and integration points.

##### 1) End-to-end recording flow (high-level)
```mermaid
flowchart TD
  Start[User starts recording] --> SelectProject{Project selected?}
  SelectProject -->|No| AutoCreate[Auto-create project + set title from first recording]
  SelectProject -->|Yes| Associate[Associate recording with selected project]
  AutoCreate --> CreateRec[Create recording row (status=uploaded)]
  Associate --> CreateRec
  CreateRec --> Upload[Upload audio to Supabase Storage]
  Upload --> Submit[Call POST start-transcription]
  Submit --> Transcribe[Server downloads blob calls OpenAI Speech-to-Text persists DB]
  Transcribe --> Done{Transcription succeeded?}
  Done -->|Yes| Update[Recording transcribed + master_transcript appended + summary if implemented]
  Done -->|No| Fail[Recording failed + error surfaced]
```

##### 2) Core data model (Supabase Postgres)
Notes:
- No end-user auth in v1. The Next.js server uses `SUPABASE_SERVICE_ROLE_KEY`.
- RLS can be enabled, but service-role will bypass it. Policies should still be set for safety and future auth.

Tables:
1. `projects`
   - `id` uuid PK
   - `title` text
   - `description` text null
   - `direction_files` jsonb null
   - `title_locked` boolean default false
   - `master_transcript` text default '' (append-only behavior)
   - `summary` text default '' (incrementally updated)
   - `created_at`, `updated_at`
2. `recordings`
   - `id` uuid PK
   - `project_id` uuid FK nullable (nullable until “project association” rules are applied)
   - `status` text enum-like:
     - `uploaded`, `transcription_pending`, `transcribed`, `failed`
   - `audio_storage_path` text
   - `audio_mime_type` text
   - `duration_ms` bigint null
   - `transcript_text` text null
   - `transcription_raw` jsonb null
   - `output_summary` text null
   - `created_at`, `updated_at`
3. `transcription_jobs` *(optional in v1 — synchronous OpenAI in `start-transcription` may skip job rows; keep table for future async/retries)*
   - `id` uuid PK
   - `recording_id` uuid FK
   - `external_job_id` text null unique *(provider-agnostic; unused when no async queue)*
   - `status` text:
     - `queued`, `running`, `succeeded`, `failed`
   - `result_payload` jsonb null
   - `error_message` text null
   - `created_at`, `updated_at`

Indexing (minimum):
- `recordings(project_id, created_at desc)`
- `transcription_jobs(recording_id)`

Future (not v1):
- Vector store tables (`transcript_chunks`, embeddings) once enabled.

##### 3) API routes (Next.js App Router)
All endpoints are implemented as server route handlers (`app/api/.../route.ts`).

Projects
- `GET /api/projects`
  - Returns: list of projects ordered by `updated_at desc`
- `POST /api/projects`
  - Body: `{ title?: string, description?: string }`
  - Returns: created project
- `GET /api/projects/:projectId`
  - Returns: `{ project, recordingsSummary }` (and master transcript fields)
- `PATCH /api/projects/:projectId`
  - Body: `{ title?: string, description?: string }` (only if not locked)

Recordings
- `POST /api/projects/:projectId/recordings`
  - Creates recording row + returns upload instructions (signed upload URL or signed params)
- `POST /api/recordings/:recordingId/submit-audio`
  - Marks status transitions to `transcription_pending` (if used before start-transcription)
- `POST /api/recordings/:recordingId/start-transcription`
  - Server-only: load audio from Storage → **OpenAI** `/audio/transcriptions` → update `recordings` + `projects.master_transcript` (and optional `transcription_jobs` / summary per `note-003.md`)
- `GET /api/recordings/:recordingId`
  - Returns recording status + transcript fields if complete

**Transcription integration (OpenAI, server-side)**  
- Configure `OPENAI_API_KEY` and optional `OPENAI_BASE_URL` in `.env.local`.  
- Route handler downloads the object from the private bucket, sends multipart audio to the transcription endpoint, then persists text/raw JSON as designed.  
- Respect OpenAI per-file size limits (see `human-tasks.md`). Long-running routes may set `maxDuration` where the host supports it.

Search/Chat
- v1 (not implemented yet): placeholder API route signature:
  - `POST /api/projects/:projectId/chat`
  - Body: `{ message: string, contextMode: "transcript_only" }`

##### 4) Component structure (UI)
Recommended folder layout:
- `app/`
  - `app/page.tsx` (main list)
  - `app/projects/[projectId]/page.tsx` (tabs + searchable transcript/summary panes)
  - `app/projects/[projectId]/recordings/[recordingId]/page.tsx` (recording metadata + tabs + audio player)
- `components/`
  - `record/`
    - `RecordButton`
    - `WaveformRecorder`
    - `RecordingTransportControls` (pause/resume/save)
  - `projects/`
    - `ProjectList`
    - `ProjectCard`
    - `ProjectTabs`
  - `text/`
    - `SearchableTextPane` (renders transcript/summary with text highlight)
  - `playback/`
    - `AudioPlayer`
  - `chat/`
    - `ChatPanel` (non-persistent session v1)
  - `common/`
    - `EmptyState`
    - `TabBar`

##### 5) State management approach
- Server state: `@tanstack/react-query`
  - Project list query
  - Project detail query
  - Recording polling query (`refetchInterval` while transcribing)
- Local UI state:
  - Recording screen: local state + optional `zustand` store for in-progress waveform/timeline and pause/resume.

##### 6) File storage strategy (Supabase Storage)
- Storage bucket: **`recordings`** (set `SUPABASE_STORAGE_BUCKET_AUDIO`; must match the private bucket you create in Supabase)
- Object path convention:
  - `projects/{projectId}/recordings/{recordingId}/audio.webm`
- Upload flow:
  1. Client requests a recording row + upload instructions
  2. Client records audio with MediaRecorder (browser)
  3. Client uploads to Supabase Storage using signed upload URL/params
  4. Client (or server) calls `POST .../start-transcription`; server reads the object and runs OpenAI STT

##### 7) Vector store integration (later)
Not required in v1. Still define an abstraction now so UI doesn’t change later:
- Retrieval API interface concept:
  - `retrieveProjectContext(projectId, queryText, topK) -> [{ text, source, score }]`
- Once vector store is enabled:
  - Chunk `projects.master_transcript` and each `recordings.transcript_text`
  - Store chunks + embeddings
  - Retrieval returns top-k chunks for grounding chat and semantic search

##### 8) Authentication (explicitly not needed for phase 1)
- No end-user auth in the first phase.
- Next.js server uses Supabase service role key for DB and storage operations.
- UI talks only to Next.js own API routes; it never uses Supabase service role key.
- Future: if multi-user is added, implement per-user auth and store per-user RLS policies.

### Acceptance Criteria
1. `note-recording-app` contains a runnable Next.js App Router project with TypeScript and ESLint configured.
2. Root UI routes exist (`/`, `/projects/[projectId]`, `/projects/[projectId]/recordings/[recordingId]`) with basic placeholders.
3. Environment variable validation is in place (app fails fast if required env vars are missing).
4. Architecture documentation in this file is complete and consistent with:
   - Supabase (Postgres + private Storage)
   - **OpenAI Speech-to-Text** from Next.js route handlers (no separate workflow engine)
   - No authentication in phase 1

### Testing that I will do (agent)
1. Run locally:
   - `npm run lint` (or `pnpm lint`)
   - `npm run typecheck` (if configured)
   - `npm run dev` and open:
     - `/`
     - `/projects/<any-project-id>`
     - `/projects/<any-project-id>/recordings/<any-recording-id>`
2. Verify env validation behavior:
   - Temporarily remove one required env var in `.env.local`, start the dev server, and confirm it fails fast with a readable error message.
3. Verify the skeleton builds:
   - Run `npm run build` (or `pnpm build`) if available, ensuring there are no build-time type errors from placeholder components.
4. No live integration validation yet:
   - Confirm placeholder UI does not require live Supabase/OpenAI connectivity beyond what `ensureServerEnvLoaded` needs at boot.

### Your check-off acceptance criteria
1. Dev server starts successfully with correct env vars, and missing env vars produce a clear error.
2. Routes render placeholders at `/`, `/projects/[projectId]`, and `/projects/[projectId]/recordings/[recordingId]` without runtime crashes.
3. Lint/typecheck/build pass (or are clean enough for you to approve as “scaffold done”).

