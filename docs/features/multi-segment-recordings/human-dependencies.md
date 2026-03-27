# Human dependencies

## Before you start

The app expects Supabase Postgres to include `public.note_recording_segments` and for existing `note_recordings` rows to have been backfilled with at least one segment. The Next.js server continues to use `SUPABASE_SERVICE_ROLE_KEY` and your private audio bucket; no new environment variables were added for this feature.

---

# Supabase database

## Apply the migration

You must create `note_recording_segments` **before** the verification query below will work. Pick **either** the SQL Editor path (works for every project) **or** the CLI path (requires `supabase link`).

### Step 1a: Run migration SQL (recommended — Supabase SQL Editor)

**Action:** Dashboard → **SQL** → **New query**. Paste the **entire** contents of the repo file `supabase/migrations/20250322120000_note_recording_segments.sql`, then **Run**.

**Expected output:** `Success. No rows returned` (or similar). That is **normal**: `CREATE TABLE`, `INSERT`, etc. do not return data rows like a `SELECT` does. If the editor shows **no error in red**, the migration likely succeeded.

**If you see any red error message:** Copy the full text; the migration did not fully apply until that is fixed.

**If this fails with `function public.set_updated_at() does not exist`:** Your database is missing the `note-001` trigger helper. In the same SQL Editor, ensure `public.set_updated_at` exists (see `supabase/migrations/20250320120000_note001_core_schema.sql` in the repo), then run the segments migration again.

### Step 1b: Or apply via Supabase CLI (optional)

From the repository root, with the project linked:

```bash
cd /path/to/note-recording-app
npx supabase db push
```

**Expected output:** Migration applies without SQL errors; CLI reports success (wording depends on Supabase CLI version). Exit code `0`.

**If this fails:** Use Step 1a instead (SQL Editor).

### Step 2: Verify table and backfill (SQL Editor)

**Action:** In Supabase Dashboard → SQL → New query:

```sql
select count(*) as segment_rows from public.note_recording_segments;
select count(*) as recording_rows from public.note_recordings;
```

**Expected output:** `segment_rows` is **greater than or equal to** `recording_rows` after migration (each recording has at least one segment).

**Pass if:** Both counts run without error and the inequality holds.

**Fail if:** `relation "note_recording_segments" does not exist` — you skipped Step 1a/1b; run the migration SQL first. **Or** `segment_rows` is `0` while `recording_rows` is non-zero (backfill did not run; re-check the `INSERT` block in the migration ran without error).

### Step 3: Diagnostics (if Step 2 still errors or counts look wrong)

Run **A**, then **B**, then **C** in order (new query each time is fine). Run **D** only if **A** returned a non-null value (the table exists). If **D** would error, skip it — that means the segments table is missing.

**A — Does the segments table exist?** (`NULL` = missing)

```sql
select to_regclass('public.note_recording_segments') as segments_table;
```

**B — What recording-related tables exist?**

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name ilike '%record%'
order by table_name;
```

**C — How many parent recordings?**

```sql
select count(*) as recording_rows from public.note_recordings;
```

**D — How many segments?** (only if A was not null)

```sql
select count(*) as segment_rows from public.note_recording_segments;
```

**How to read it:**

- **`segments_table` is NULL:** The migration never created the table (wrong Supabase project, script not fully run, or a red error stopped the script). Re-run Step 1a and read the **entire** editor output for errors.
- **You have `recordings` but not `note_recordings`:** This app expects `public.note_recordings` (see `note-001` migration). The segments SQL targets `note_recordings`; rename or migrate your data to match, or the backfill will not apply.
- **`segment_rows` = 0 and `recording_rows` > 0:** Table exists but the backfill `INSERT` did not populate rows. Re-run only the `INSERT INTO public.note_recording_segments ... SELECT ...` block from the migration file and note any error.

You can paste the **result grids for A and B** (and C/D if they run) here or into a chat with your agent — that is enough to confirm naming and whether the migration landed on the right database.

---

# Local application

## Install and build

### Step 1: Install dependencies

```bash
cd /path/to/note-recording-app
npm install
```

**Expected output:** Completes with exit code `0`.

### Step 2: Typecheck and lint

```bash
npm run typecheck && npm run lint
```

**Expected output:** Both exit code `0`, no errors printed.

---

# Human acceptance criteria

Use this checklist after the migration is applied and `npm run dev` is running with a valid `.env.local` (Supabase + OpenAI as before).

---

# Recording lifecycle

## Create, append, play, transcribe

### Step 1: Create a recording and wait for transcription

**Action:** Open a project in the UI (e.g. `/legacy/projects/{projectId}`), create a new recording, wait until status is **Transcribed**.

**Expected result:** Recording detail shows transcript and audio plays.

**Pass if:** Audio plays from the player and transcript is non-empty.

**Fail if:** Errors in UI or recording stuck in failed (check server logs).

### Step 2: Append a second part (record)

**Action:** On the same recording detail page, click **Record more**, complete a short recording, save.

**Expected result:** Status returns to **Uploaded** then **Transcribing**, then **Transcribed**. “Audio parts” shows **2 files**.

**Pass if:** Transcript updates to include multiple sections (e.g. `[Part 0]` / `[Part 1]` or merged layout) and no duplicate full recording block in the project master transcript for the same recording id.

**Fail if:** Transcription does not run or stays pending indefinitely (see server logs and DB segment rows).

### Step 3: Playback order

**Action:** Use the audio player; play through the end of the first part.

**Expected result:** Label shows **part 1 of 2** then **part 2 of 2** (or similar); second part starts after the first ends.

**Pass if:** Both parts play in order without manually reloading the page.

**Fail if:** Only one part plays or the second part never loads (check Network tab for `/signed-playlist` and signed URLs).

### Step 4: Append via file upload

**Action:** Click **Upload audio file**, choose a short audio file (e.g. `.webm` or `.mp3`).

**Expected result:** Upload completes; transcription runs; part count increases by one.

**Pass if:** New part appears in playback order after previous parts.

**Fail if:** HTTP error toast/message or upload stuck.

---

# API spot-check (optional)

## Segment creation

### Step 1: `POST` append instructions

**Action:** Replace UUIDs and run (with dev server on port 3000):

```bash
curl -sS -X POST "http://127.0.0.1:3000/api/recordings/RECORDING_UUID/segments?projectId=PROJECT_UUID" \
  -H "Content-Type: application/json" \
  -d '{"audioMimeType":"audio/webm"}'
```

**Expected result:** HTTP `201` and JSON containing `segmentId`, `signedUpload.path`, `storageBucket`.

**Pass if:** Status `201` and fields present.

**Fail if:** `404` (wrong ids), `500` (DB/storage), or `400` (missing `projectId`).
