## note-001 — Supabase Schema + Projects/Recordings API + Storage Upload Plumbing

### Prerequisites
1. `note-recording-app/tasks/note-000.md` completed.
2. `note-recording-app/tasks/human-tasks.md` completed (Supabase project + Storage bucket exist, env vars ready).

### Detailed Implementation Steps
#### A) Implement Supabase database schema (projects, recordings, transcription_jobs)
1. Create the tables in Supabase (recommended: Supabase migrations / SQL files).
2. Create columns/constraints:
   - `projects` with `title_locked`, `master_transcript`, `summary`
   - `recordings` with `project_id` nullable and `status` values (`uploaded`, `transcription_pending`, `transcribed`, `failed`)
   - `transcription_jobs` referencing `recordings`
3. Add indexes:
   - `recordings(project_id, created_at desc)`
   - `transcription_jobs(recording_id)`
   - Optional: unique constraint/index on `transcription_jobs.external_job_id` (only if you store async provider ids)
4. Add `updated_at` behavior:
   - Either:
     - DB trigger to set `updated_at = now()` on update, or
     - App-layer updates (preferred DB trigger).
5. RLS policy strategy for v1 (no end-user auth):
   - Keep RLS enabled.
   - Ensure no public/anon access is granted for `projects`, `recordings`, and `transcription_jobs`.
   - Next.js server uses the service role key, so it will bypass RLS for server-side operations.

#### B) Configure Supabase Storage
1. Confirm bucket:
   - `SUPABASE_STORAGE_BUCKET_AUDIO` (documented default: **`recordings`** — must match your Supabase bucket name)
2. Decide access model:
   - Bucket access: private
   - Playback and transcription must use **signed URLs** generated server-side.
3. Create/verify Storage policies:
   - For v1, deny public reads/writes.
   - Allow only the service role to generate signed URLs and manage objects.

#### C) Add Next.js server utilities for Supabase (admin client + signed URLs)
Create modules (names can vary):
1. `lib/supabase/serverAdmin.ts`
   - Creates Supabase client using `SUPABASE_SERVICE_ROLE_KEY`
2. `lib/supabase/storage.ts`
   - `getRecordingObjectPath(recordingId, projectId)`
   - Signed upload:
     - Provide a helper to create a signed upload URL (or signed upload form fields, depending on Supabase API).
   - Signed read:
     - Provide a helper to create signed read URLs for audio playback and for **server-side** download before OpenAI transcription.

#### D) Implement API routes for projects and recordings
1. Projects endpoints:
   - `GET /api/projects`
     - Return `{ id, title, description, updatedAt, masterTranscriptPreview, recordingsCount }`
   - `POST /api/projects`
     - Insert a new `projects` row
     - If `title` is omitted, allow `title` placeholder (or leave empty for first recording to set it later)
   - `GET /api/projects/:projectId`
     - Return project fields including `master_transcript` and `summary`
   - `PATCH /api/projects/:projectId`
     - Allow updating `description` and/or `title` only if `title_locked` is false
2. Recording creation + upload instructions:
   - `POST /api/projects/:projectId/recordings`
     - Body (recommended):
       - `{ audioMimeType?: string }` (optional)
     - Steps:
       - Create `recordings` row:
         - `status = 'uploaded'` (or `transcription_pending` if you prefer)
         - `audio_storage_path` should be determinable deterministically from ids
       - Return upload instructions:
         - `recordingId`
         - `audioStoragePath`
         - `signedUpload` payload (URL or fields)
3. Validate request inputs using `zod` (optional but recommended).
4. Error handling:
   - Return meaningful HTTP codes:
     - `404` for missing project/recording
     - `409` for invalid status transitions
     - `500` for unexpected errors

#### E) (Optional but recommended) Add a simple health endpoint
- `GET /api/health`
- Confirms env vars exist and Supabase is reachable (no sensitive info).

### Acceptance Criteria
1. Supabase tables exist with correct columns and indexes:
   - `projects`, `recordings`, `transcription_jobs`
2. Storage bucket configuration works with signed URLs:
   - server can generate signed upload/read URLs
3. API routes exist and behave correctly:
   - create/list/get/patch projects
   - create recording under a project and return upload instructions
4. Calling the API routes from a dev script (or manual requests) results in:
   - new DB rows created
   - audio object paths recorded in `recordings.audio_storage_path`

### Testing that I will do (agent)
1. Verify Supabase schema and RLS expectations:
   - Insert/read/update via the server admin client using the service role key
   - Confirm anon/public access is not possible (no public rows visible without service role)
2. Verify storage signed URL flow end-to-end:
   - Call `POST /api/projects/:projectId/recordings` to get signed upload instructions
   - Upload a small audio blob to the signed destination
   - Ask the server for a signed read URL and confirm the audio is downloadable (same bytes the transcribe route will fetch server-side)
3. Verify API behaviors:
   - `POST /api/projects` creates a project row
   - `GET /api/projects` returns created projects
   - `PATCH /api/projects/:projectId` updates description/title when not locked
4. Verify error handling:
   - invalid `projectId` returns `404`
   - missing env vars causes a clear failure at server startup or first call
5. Lint/typecheck/build (where available):
   - `npm run lint`
   - `npm run typecheck` (if configured)
   - `npm run build` (if scaffold created it)

### Your check-off acceptance criteria
1. `projects`, `recordings`, `transcription_jobs` exist with expected columns and at least the listed indexes.
2. Storage bucket supports signed upload and signed read URLs generated by the Next.js server.
3. The four project/recording API behaviors in the “Acceptance Criteria” section work from a manual test or curl script.
4. Basic error responses match the documented HTTP codes/messages closely enough that you can verify them quickly.

