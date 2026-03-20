## note-006 — Global Natural Language Search Across Projects/Recordings

### Prerequisites
1. `note-recording-app/tasks/note-005.md` completed (vector store + chunk ingestion + retrieval primitives exist).
2. At least one recording has been transcribed and embedded for test coverage.

### Detailed Implementation Steps
#### A) Implement global retrieval
1. Add server function:
   - `retrieveGlobalChunks(queryText, topK)`
2. Add an API endpoint:
   - `POST /api/search`
     - Body: `{ query: string, topK?: number }`
     - Returns:
       - ranked results with `{ projectId, recordingId?, chunkText, score, metadata }`

#### B) Define search UX
1. Main list view (`app/page.tsx`):
   - Add a global search bar at the top
   - When query is non-empty:
     - call `/api/search`
     - show results grouped by project (or flat list with project labels)
2. Result presentation:
   - Show:
     - project title
     - recording timestamp (if available)
     - snippet (chunkText) with highlighted query terms (optional since semantic search)
3. Navigation:
   - Each result card links to:
     - `app/projects/[projectId]/recordings/[recordingId]/page.tsx` when recordingId is available
     - else `app/projects/[projectId]/page.tsx` (project-level results)

#### C) Highlighting semantics (optional enhancement)
Even though matching is semantic, you can still improve UX:
1. If you have the raw query string:
   - highlight literal query terms within returned `chunkText`
2. If query is short:
   - also highlight common keywords from query

### Acceptance Criteria
1. Users can search from the main list view and get relevant results.
2. Results include enough context to click through to the exact recording.
3. Searching works across multiple projects and multiple recordings.

### Testing that I will do (agent)
1. Multi-project test matrix:
   - Create at least two projects.
   - Transcribe at least one recording in each.
   - Embed both.
2. Query behavior tests:
   - Literal phrase query: confirm relevant results.
   - Semantic query: confirm results even without exact keyword overlap.
   - Absent query: confirm “no results” state (and no server errors).
3. Result navigation tests:
   - Click through to recording pages from search results.
   - Confirm the linked recordingId matches the result it came from.
4. Performance check:
   - Measure response time for `POST /api/search` for typical query loads (e.g., topK=10–20).
   - Confirm UI remains responsive while results load.

### Your check-off acceptance criteria
1. Global search returns correct/meaningful results for at least 3 query types (literal, semantic, absent).
2. Search results link to the right project/recording pages.
3. Search works across multiple projects/recordings (not only one project).

