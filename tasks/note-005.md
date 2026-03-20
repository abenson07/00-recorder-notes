## note-005 — Vector Store Integration + Project Chat Grounding via Retrieval

### Prerequisites
1. `note-recording-app/tasks/note-004.md` completed (UI + chat endpoint signature exists).
2. `note-recording-app/tasks/note-003.md` completed (recording transcripts and project master transcript are populated).
3. You have chosen an embedding strategy/provider for semantic search (can be local or hosted).

### Detailed Implementation Steps
#### A) Enable pgvector (or chosen vector DB) in Supabase
1. Install/enable the `pgvector` extension in your Supabase Postgres environment.
2. Create vector-related tables (example):
   - `transcript_chunks`
     - `id` uuid PK
     - `project_id` uuid FK nullable (or not nullable if all chunks are project-scoped)
     - `recording_id` uuid FK nullable
     - `source_type` text (e.g., `master_transcript`, `recording_transcript`)
     - `chunk_text` text
     - `metadata` jsonb null (timestamps, chunk index, etc.)
     - `created_at`
   - `transcript_embeddings`
     - `id` uuid PK
     - `chunk_id` uuid FK unique
     - `embedding` vector(<dimension>)
     - `created_at`
3. Add indexes:
   - `ivfflat` or `hnsw` index depending on pgvector capabilities

#### B) Define chunking and embedding ingestion pipeline
1. Chunking strategy:
   - Decide max characters/tokens per chunk (e.g., 500-1000 tokens, approximate by characters)
   - Ensure chunks preserve ordering and useful boundaries (paragraphs/sentences)
2. Ingestion triggers:
   - After each successful recording transcription (in `note-003` or in an incremental migration step):
     - create new chunks for:
       - the recording transcript
       - optionally update master transcript chunks (either re-chunk entire master or chunk only new appended transcript)
3. Embedding generation:
   - Implement an embedding function:
     - inputs: `chunk_text`
     - outputs: embedding vector matching the DB dimension
   - Store embedding into `transcript_embeddings`

#### C) Implement retrieval API (project-scoped and global)
1. Add server functions:
   - `retrieveProjectChunks(projectId, queryText, topK)`
   - `retrieveGlobalChunks(queryText, topK)` (used later in `note-006`)
2. Add endpoints (at least project-scoped for this task):
   - `POST /api/projects/:projectId/retrieve`
     - Body: `{ query: string, topK?: number }`
     - Returns: ranked chunks with `text` and `metadata`

#### D) Implement chat grounding for `POST /api/projects/:projectId/chat`
1. Update chat endpoint to:
   - Retrieve relevant chunks for the user message
   - Build a prompt that includes:
     - system instructions
     - retrieved chunk texts
     - user message
   - Call your chosen LLM for response generation
2. Add citations (optional but recommended):
   - Include chunk metadata or chunk index in the response payload so UI can show “sources”.
3. Keep chat non-persistent:
   - Maintain conversation context only in the active browser session (client state)

#### E) Update UI (minimal)
1. Chat UI should display answers and optionally citations.
2. Ensure it gracefully handles:
   - empty retrieval results
   - embedding/ingestion failures (return a fallback response)

### Acceptance Criteria
1. After a new recording is transcribed, embeddings are created and stored.
2. `POST /api/projects/:projectId/retrieve` returns relevant chunks for a natural language query.
3. Chat responses are grounded in retrieved chunks from:
   - the project’s transcripts
4. UI chat works without runtime errors and returns an answer within a reasonable timeout.

### Testing that I will do (agent)
1. Embedding ingestion test:
   - After a new recording is transcribed, confirm that `transcript_chunks` rows exist (if you use chunk table) and corresponding embeddings are inserted into `transcript_embeddings`.
2. Retrieval endpoint test:
   - Call `POST /api/projects/:projectId/retrieve` with queries that:
     - directly match a phrase
     - are paraphrases of a phrase
   - Confirm the returned top-K includes chunks containing the expected phrase.
3. Chat grounding test:
   - Ask a question in chat that requires knowledge from the project transcript.
   - Confirm the response aligns with retrieved chunks.
   - If citations/sources are implemented, confirm they correspond to the returned chunks.
4. Failure tests:
   - Simulate embedding provider timeout/error and confirm:
     - `POST /api/projects/:projectId/chat` returns a safe error message
     - UI does not crash and offers retry (if implemented).

### Your check-off acceptance criteria
1. Embeddings are created/available after transcription (not just “code exists”).
2. Retrieval returns ranked chunks that are observably relevant to the query.
3. Chat answers are backed by retrieved chunks from the specified project.
4. UI chat completes without runtime errors and within an acceptable latency bound you set.

