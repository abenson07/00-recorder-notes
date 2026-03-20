## note-004 — Project Detail UI (Summary/Transcript Tabs, Search Highlight) + Recordings List + Playback

### Prerequisites
1. `note-recording-app/tasks/note-003.md` completed (transcripts and summaries exist after transcription).
2. `note-recording-app/tasks/note-002.md` completed (audio playback-ready recording objects exist in storage).

### Detailed Implementation Steps
#### A) Project Detail page with Summary + Transcript tabs
1. Update `app/projects/[projectId]/page.tsx` to:
   - Render project header:
     - title
     - optional description
   - Render two tabs:
     - `Summary` tab
       - shows `projects.summary`
     - `Transcript` tab
       - shows `projects.master_transcript`
2. Search within panes:
   - Add a search input shared by both tabs
   - Implement `components/text/SearchableTextPane`
     - highlight matches of the query
     - keep rendering performant:
       - avoid generating huge React node trees for large transcripts (use memoization or simple substring highlight)
3. Update title lock UX:
   - If `title_locked` is true, disable editing in this screen (future).

#### B) Bottom navigation (3-button layout)
Implement the bottom navigation described in the brief:
1. Left button: Chat icon → open chat interface
   - v1 behavior: “transcript-only” answers
   - Note: vector-store grounding arrives in `note-005`
2. Center button: Record → open recording interface scoped to this project
3. Right button: Recordings icon → show list of individual recordings

#### C) Recordings list (newest first) and navigation to individual recording pages
1. Add a view/list on the project detail screen (or a sub-route) that displays recordings:
   - Order: newest first (`recordings.created_at desc`)
   - Each item shows:
     - created timestamp
     - status (pending/transcribed/failed)
     - short transcript preview or per-recording output summary preview
2. Each item links to:
   - `app/projects/[projectId]/recordings/[recordingId]/page.tsx`

#### D) Individual Recording view
On `app/projects/[projectId]/recordings/[recordingId]/page.tsx`:
1. Display recording metadata:
   - created time
   - audio mime type
   - duration (if stored)
   - transcription status
2. Two tabs inside recording view:
   - `Output/Summary` tab
     - show `recordings.output_summary` (if available) or transcript-based summary placeholder
   - `Transcript` tab
     - show `recordings.transcript_text`
3. Playback controls:
   - Use `components/playback/AudioPlayer`
   - Fetch a signed read URL for the audio object server-side:
     - Can be returned by `GET /api/recordings/:recordingId` response
4. Search within transcript/summary:
   - Reuse `SearchableTextPane`

#### E) Chat interface wiring (stub for v1)
1. Implement `components/chat/ChatPanel` UI shell:
   - maintains local session state
   - messages list (user + assistant)
2. Implement POST endpoint signature as a stub (the real grounding is later):
   - `POST /api/projects/:projectId/chat`
3. For v1 placeholder:
   - either:
     - return “not implemented yet”
   - or:
     - return a basic response using `projects.master_transcript` and a simple prompt (no vector retrieval yet)

### Acceptance Criteria
1. Project detail UI renders:
   - header with title/description
   - Summary and Transcript tabs
   - search field that highlights matching text
2. Recordings list shows:
   - chronological ordering (newest first)
   - status for pending/transcribed/failed
3. Individual recording page:
   - displays transcript/output when available
   - can play audio via playback controls (signed URL)
4. Chat UI exists and accepts messages without crashing (grounding correctness is deferred to `note-005`).

### Testing that I will do (agent)
1. UI smoke test across all views:
   - Navigate to main list, create a project/recording, wait for transcription.
   - Open project detail and confirm Summary and Transcript tabs render.
2. Search highlight test:
   - Search for a known phrase from the transcript/master transcript.
   - Confirm highlights appear and switching tabs preserves the query (if you want that behavior) without lag.
3. Recordings list and navigation:
   - Confirm recordings render newest-first ordering.
   - Click through to recording pages and validate metadata + tabs.
4. Audio playback test:
   - Confirm the recording page can fetch a signed URL and audio playback works.
   - Scrub/time controls should update without console errors.
5. Chat stub test:
   - Send a message to chat (even if “not implemented yet”).
   - Confirm the UI never crashes and shows a predictable response/error.

### Your check-off acceptance criteria
1. All three screens render without runtime errors:
   - project detail tabs + search
   - recordings list + newest-first ordering
   - individual recording view with output/transcript tabs
2. Playback works for at least one transcribed recording (signed URL flow).
3. Search highlighting works for literal phrases present in the text.
4. Chat UI handles messages without crashing.

