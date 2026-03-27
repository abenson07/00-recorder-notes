# Multi-segment recordings — implementation summary

## Context

A product “recording” remains one row in `note_recordings`. Multiple ordered audio files are stored in `note_recording_segments` and in Storage under `projects/{projectId}/recordings/{recordingId}/segments/{segmentId}.{ext}`. The parent row keeps `audio_storage_path` / `audio_mime_type` aligned with **segment at position 0** for backwards compatibility (e.g. legacy `signed-audio`).

## What was implemented

- **Schema:** [`supabase/migrations/20250322120000_note_recording_segments.sql`](../../../supabase/migrations/20250322120000_note_recording_segments.sql) — `note_recording_segments` table, trigger, RLS enabled, `service_role` grants, backfill from existing `note_recordings`.
- **New recording:** [`app/api/projects/[projectId]/recordings/route.ts`](../../../app/api/projects/[projectId]/recordings/route.ts) inserts segment `position = 0` with the same path as `audio.webm`.
- **Append:** [`POST /api/recordings/:recordingId/segments?projectId=`](../../../app/api/recordings/[recordingId]/segments/route.ts) creates the next segment and returns signed upload instructions.
- **Playback:** [`GET /api/recordings/:recordingId/signed-playlist?projectId=`](../../../app/api/recordings/[recordingId]/signed-playlist/route.ts) returns ordered signed URLs; [`AudioPlayer`](../../../components/playback/AudioPlayer.tsx) chains segments in one `<audio>` via `ended` → next URL (with prefetch of the following URL). Falls back to [`signed-audio`](../../../app/api/recordings/[recordingId]/signed-audio/route.ts) when the playlist returns `NO_SEGMENTS` (e.g. migration not applied).
- **Read model:** [`GET /api/recordings/:id`](../../../app/api/recordings/[recordingId]/route.ts) includes `segments` (no storage paths in JSON).
- **Transcription:** [`start-transcription`](../../../app/api/recordings/[recordingId]/start-transcription/route.ts) transcribes each segment that is `uploaded` or `failed`, merges `transcript_text` on the parent with `[Part N]` labels when there are multiple parts, appends project `master_transcript` with `[Recording {id}]` (single part) or `[Recording {id} part {n}]`, refreshes summary incrementally per segment, runs recording template once on the **merged** transcript, re-ingests transcript chunks. Legacy path (no segment rows) unchanged.
- **UI:** [`RecordingDetailClient`](../../../components/recordings/RecordingDetailClient.tsx) — “Record more” + file upload when status is `transcribed` or `failed`; [`AppendSegmentModal`](../../../components/record/AppendSegmentModal.tsx) + [`WaveformRecorder`](../../../components/record/WaveformRecorder.tsx) `appendToRecordingId`.

## Rollback

Stop creating segments in app code and revert migration only if you also handle existing data (not automated here).

## Tests to run

| When | Command | Expected |
|------|---------|----------|
| After code changes | `npm run lint` | Exit code `0` |
| After code changes | `npm run typecheck` | Exit code `0` |
| Before release | `npm run build` | Next.js build succeeds |
| With dev server + env | `BASE_URL=http://localhost:<port> npm run smoke:note-001` | Smoke script completes (covers create recording, not append) |

## Human setup and manual verification

Prerequisites and manual checks live in **[human-dependencies.md](./human-dependencies.md)** (human dependencies and acceptance criteria). Apply the database migration in that document before relying on multi-segment behavior in a real Supabase project.
