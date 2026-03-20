## note-002 — Recording Interface (Waveform, Pause/Resume, Save) + Upload + Project Association

### Prerequisites
1. `note-recording-app/tasks/note-001.md` completed (Supabase schema + upload instruction API exists).
2. `note-recording-app/tasks/note-000.md` completed (UI skeleton exists).

### Detailed Implementation Steps
#### A) Implement client-side audio recording (MediaRecorder)
1. Build `components/record/WaveformRecorder`
2. Use browser APIs:
   - `navigator.mediaDevices.getUserMedia({ audio: true })`
   - `MediaRecorder` for capturing audio into chunks
   - Web Audio API (`AudioContext` + `AnalyserNode`) for waveform visualization
3. Waveform visualization requirements:
   - Render a waveform (or simplified bar waveform) in real time
   - Add time markers:
     - Show elapsed seconds while recording (e.g., `00:12`)
   - Keep the waveform independent of transcript generation (UI-only).
4. Pause/resume:
   - Use `MediaRecorder.pause()` / `MediaRecorder.resume()`
   - Maintain UI state:
     - `isRecording`, `isPaused`, `elapsedMs`
   - Ensure pause/resume works cleanly with MediaRecorder events.
5. Stop and “Save” behavior:
   - When user hits Stop:
     - Transition to a “paused/draft ready” state
     - Show `Save` button
   - On `Save`:
     - Finalize the recording blob
     - Proceed to upload + start transcription (start transcription may be implemented in `note-003`).

#### B) Upload audio to Supabase Storage
1. Convert recording to a Blob with correct MIME type:
   - Prefer `audio/webm;codecs=opus` where supported
2. Create a recording row and signed upload destination:
   - Call `POST /api/projects/:projectId/recordings` with `audioMimeType`
3. Upload:
   - Upload the Blob to the signed upload URL/params returned by the server
4. After successful upload:
   - Call `POST /api/recordings/:recordingId/submit-audio` (if you implement this separation)
   - Or immediately call `POST /api/recordings/:recordingId/start-transcription` (route implemented in `note-003`)

#### C) Project association rules (record inside/outside project)
Implement the UX rule:
- If recording outside a project → auto-create new project and associate.
- If recording inside a project → associate with that project.
Implementation approach:
1. List page (`app/page.tsx`)
   - When floating record button is pressed and no project is selected:
     - Create a project optimistically (or create recording with a nullable project and fix up later)
     - Set initial title:
       - Option 1 (recommended): create project with placeholder title, then lock + update title after first transcript (later logic).
       - Option 2: wait for transcript, then update project title based on extracted keywords (later logic).
2. Project detail page (`app/projects/[projectId]/page.tsx`)
   - Record button uses the explicit `projectId`
   - Create recording under that project directly.

#### D) Recording screen integration + Bluetooth/screen-off notes (mobile later)
1. Desktop-first:
   - Ensure audio controls remain accessible while recording.
2. Mobile web compatibility (future):
   - Keep audio recording logic in one place so later you can add:
     - device selection (Bluetooth mic selection)
     - background/screen-off behavior constraints (platform-specific)

### Acceptance Criteria
1. Users can:
   - start recording
   - pause/resume
   - stop and save
2. After saving:
   - an audio Blob is successfully uploaded to Supabase Storage
   - a `recordings` row exists with `audio_storage_path` set
   - recording status transitions to a “ready to transcribe” state (pending) even if transcript content is not yet implemented until `note-003`.
3. Recording association rules work:
   - recording from list page creates/associates a project
   - recording from project page associates with the selected project.

### Testing that I will do (agent)
1. Desktop browser smoke test:
   - Start a recording from the main list view (outside a project) and verify a new project is created/associated.
   - Start a recording from within a project and verify the recording links to the correct project.
2. Audio lifecycle test:
   - Record 10–20 seconds, pause/resume at least once, then stop and save.
   - Confirm the saved audio blob is valid (not zero-length) and plays after upload.
3. UI behavior test:
   - Confirm pause/resume controls update the UI correctly.
   - Confirm Save button appears only in the “stopped/paused” state.
4. Error handling tests:
   - Deny microphone permission and confirm a non-technical, actionable error is shown.
   - Force an upload failure (e.g., invalid env var / break bucket perms) and confirm the UI offers a retry path.

### Your check-off acceptance criteria
1. Recording UI supports start → pause/resume → stop → save without UI crashes.
2. After save:
   - Supabase Storage contains the expected object under the agreed path convention.
   - `recordings.audio_storage_path` is set and recording status is ready for transcription.
3. Recording association rules behave correctly in both entry points (list vs project page).

