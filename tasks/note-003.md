## note-003 — OpenAI Transcription + Project Transcript/Summary Updates

### Prerequisites
1. `note-recording-app/tasks/note-002.md` completed (audio upload works and recording row exists).
2. `note-recording-app/tasks/human-tasks.md` completed (Supabase + **OpenAI** API key in `.env.local`; see `.env.example`).
3. Server env includes `OPENAI_API_KEY` and optional `OPENAI_BASE_URL` (see `lib/env.ts`).

### Detailed Implementation Steps

#### A) Server-side OpenAI Speech-to-Text (no external orchestration)
1. Implement or verify a server-only helper (e.g. `lib/openai/transcribe.ts`):
   - Calls OpenAI-compatible **`/audio/transcriptions`** (e.g. `whisper-1`).
   - Enforces per-file size limits (see `OPENAI_MAX_AUDIO_BYTES` / human-tasks).
   - Maps HTTP errors to stable app codes (`OPENAI_UNAUTHORIZED`, rate limits, etc.).
2. Implement **`POST /api/recordings/:recordingId/start-transcription`** (Route Handler):
   - Validate recording exists; require `project_id` for master-transcript updates.
   - Idempotency: if already `transcribed` with transcript text, return success without redoing work.
   - Claim work: transition `uploaded` / `failed` → `transcription_pending` (avoid duplicate in-flight runs).
   - **Download** audio from private Supabase Storage via service role.
   - Call `transcribeAudio(...)` with blob + filename inferred from path/mime.
   - On success:
     - Append to `projects.master_transcript` with a stable delimiter (e.g. `\n\n[Recording ${id}]\n${text}\n`).
     - Set `recordings.status = 'transcribed'`, `transcript_text`, `transcription_raw` (provider payload / segments as needed).
   - On failure: set `recordings.status = 'failed'`, stash details in `transcription_raw` / structured error where useful.
3. Configure the route for long-running work (e.g. `export const maxDuration = 300` on Vercel).
4. **Async jobs (`transcription_jobs`)** — optional in v1:
   - Synchronous OpenAI in the route may omit job rows entirely.
   - If you add job tracking later, use a neutral column such as `external_job_id`.

#### B) Incremental **project summary** (if not already in the route)
1. After a successful transcript, update `projects.summary` incrementally:
   - Input: existing summary, new transcript (and optionally full master transcript).
   - Output: refreshed outline text.
2. Implementation options:
   - **Option A:** Second OpenAI (chat/completions) call in Next.js with a small prompt.
   - **Option B:** Defer to a later note (document as TODO) if v1 only appends `master_transcript`.

#### C) Client refresh / polling
1. After upload + `start-transcription`, the UI may:
   - Await the POST (simplest for sync route), and/or
   - Poll **`GET /api/recordings/:recordingId`** while status is `transcription_pending` (useful if the client disconnects or times out).
2. Use `@tanstack/react-query` with `refetchInterval` until `transcribed` or `failed`.
3. UI states: uploaded → pending → transcribed | failed (with retry CTA).

#### D) Retry and failure UX
1. **Retry transcription** when `failed` (server allows `failed` → `transcription_pending` again).
2. Surface OpenAI errors (401, 413, 429, generic) with readable copy.

### Acceptance Criteria
1. From a saved recording, **`POST .../start-transcription`** downloads storage audio, calls OpenAI, and persists results.
2. **`GET /api/recordings/:recordingId`** reflects `transcribed` / `failed` and transcript fields when complete.
3. DB updates:
   - `recordings.transcript_text` populated on success.
   - `projects.master_transcript` appends the new block in order.
   - `projects.summary` updates per your chosen Option A/B above (when implemented).
4. Failures set `failed` and preserve enough detail to debug (without leaking secrets).

### Testing that I will do (agent)
1. **OpenAI / route:**
   - Short clip: expect 200, `transcribed`, transcript non-empty.
   - Invalid API key: expect clear error path.
   - File over limit: expect 413 / failure handling per route.
2. **End-to-end:** record → upload → start-transcription → (poll if needed) → `transcribed`, master transcript contains the recording block.
3. **Idempotency:** call `start-transcription` twice after success; no duplicate append.
4. **Failure + retry:** simulate OpenAI error → `failed` → retry → success.

### Your check-off acceptance criteria
1. Starting transcription runs OpenAI server-side and updates DB fields as above.
2. After completion, the project master transcript includes the new recording block at the end.
3. Project summary behavior matches whatever you locked in for v1 (implemented or explicitly deferred).
4. Failed transcription shows a clear error and retry works.
