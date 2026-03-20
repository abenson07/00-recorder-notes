# **Human guide: note-005 acceptance (vector retrieval + grounded chat)**

**Purpose:** Step-by-step checks so a person can confirm **embeddings**, **retrieval**, **chat grounding**, and **UI** behavior without guessing. Run against your **deployed or local** app with **Supabase migration applied** and **`npm run dev`** (or production URL) as appropriate.

---

## **Before you start**

- **Confirm** the SQL migration ran: `supabase/migrations/20250320120300_note005_pgvector_transcript_chunks.sql` (vector extension + chunk tables + RPCs).
- **Confirm** `.env.local` (or host secrets) has **OpenAI** key + base URL; same app that does transcription.
- **Open** the app in a browser and **note** one **project ID** from the URL: `/projects/<uuid>`.
- **Optional:** Install Node deps and keep **one terminal** on `npm run dev` for automated checks.

---

## **A. Database tables exist**

1. **Go to** Supabase → **Table Editor**.
2. **Open** `transcript_chunks` and `transcript_embeddings`.
3. **Confirm** both tables open with no permission errors.

**Pass when:** You can see the two tables (empty or with rows).

---

## **B. Embeddings after a new transcription**

1. **Go to** `/projects/<projectId>` in the app.
2. **Record** (or use an existing recording) and **run transcription** until the recording is **transcribed** and text appears.
3. **Go to** Supabase → **Table Editor** → filter `transcript_chunks` by **project_id** = your project.
4. **Confirm** new rows: `source_type` = `recording_transcript`, sensible `chunk_text`.
5. **Confirm** matching rows in `transcript_embeddings` (same count as chunks for that recording, one embedding per chunk).

**Pass when:** Chunks and embeddings exist for the recording you just transcribed (or re-transcribed after note-005 shipped).

**If missing:** Check server logs for `[start-transcription] chunk ingest` — ingestion failures are logged but transcription may still succeed.

---

## **C. Retrieval API (automated — no curl needed)**

1. **In the project folder**, with dev server running:  
   `npm run smoke:note-005-retrieve`
2. **Optional:** Pin a project:  
   `SMOKE_PROJECT_ID=<your-uuid> npm run smoke:note-005-retrieve`
3. **Optional:** Pin URL/port:  
   `BASE_URL=http://127.0.0.1:3001 npm run smoke:note-005-retrieve`

**Confirm** the script prints **“All retrieve checks passed”** and exits **0**.

**Pass when:** Script succeeds (two queries + bogus UUID → 404).

---

## **D. Project chat — happy path**

1. **Open** `/projects/<projectId>` → **Chat** (dock/tab).
2. **Ask** a question that **only** the project’s notes can answer (specific fact from a recording).
3. **Confirm** you get a **normal** assistant reply (not the old “transcript-only v1” stub).
4. **Confirm** **Sources** may appear with short previews and a match-style label when retrieval hit.
5. **Confirm** the answer **matches** what’s in the transcript (no obvious wrong project).

**Pass when:** Answer is sensible, aligned with notes, and the UI shows no errors in the browser **Console**.

---

## **E. Chat — fallback when retrieval is weak**

1. **Stay** in **Chat**.
2. **Ask** something **vague** or **unrelated** to any chunk (or use a project with little indexed text).
3. **Confirm** you still get a reply or a **clear** message — **not** a blank screen.
4. **Confirm** if the UI shows the **“No semantic matches”** line, the answer still **relates** to the **project transcript/summary** excerpt.

**Pass when:** No crash; user understands the assistant used broader context when matches were thin.

---

## **F. Chat / API errors (safe failure)**

1. **Only in a safe local test:** temporarily use a **bad** `OPENAI_API_KEY`, restart dev, send a chat message.
2. **Confirm** the response is an **error message** (JSON/API), not a stack trace in the UI.
3. **Confirm** the chat panel **does not** white-screen; you can read the error.
4. **Restore** the real key and **confirm** chat works again.

**Pass when:** Failures are readable and recoverable after fixing env.

---

## **G. Optional — project isolation**

1. Use **two projects** with **different** transcript content.
2. In project **A** chat, ask about something that exists **only** in project **B**.
3. **Confirm** the answer does **not** leak **B**’s exclusive content.

**Pass when:** Retrieval and answers stay scoped to the open project.

---

## **Done when (sign-off)**

- **Tables** exist and **chunks + embeddings** appear after transcription.
- **`npm run smoke:note-005-retrieve`** passes.
- **Chat** answers from **project context**, shows **sources** when relevant, **fallback** messaging when not, **no** console/runtime errors under normal use.
- **Errors** from OpenAI are **handled** without breaking the page.
