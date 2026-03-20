## Manual Prerequisites for `note-recording-app`

This file lists one-time setup steps you must complete manually before implementing the code in the subsequent task notes.

### 1) Create a Supabase project (Postgres + Storage)
1. Create a new Supabase project.
2. Note these values:
   - `NEXT_PUBLIC_SUPABASE_URL` (same as project URL)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (Dashboard → API → publishable/anon key for browser + `@supabase/ssr`)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to the client)
3. Enable **Storage**:
   - Create a bucket named `recordings` (or pick a name and set `SUPABASE_STORAGE_BUCKET_AUDIO` to match).
   - Configure bucket access as **private**.
   - Verify you can generate signed URLs from the Supabase server-side SDK.

### 2) OpenAI (Whisper) transcription
The app calls **OpenAI’s Speech-to-Text API** from Next.js route handlers (no separate workflow/automation layer).

1. Create an [OpenAI API key](https://platform.openai.com/api-keys) with access to **audio** / `whisper-1`.
2. Add **`OPENAI_API_KEY`** to `.env.local` (server-only; never `NEXT_PUBLIC_*`).
3. Optional **`OPENAI_BASE_URL`**: defaults to `https://api.openai.com/v1`. Set this for Azure OpenAI or another OpenAI-compatible endpoint that exposes `/audio/transcriptions`.
4. **Limits**: each transcription request must stay within OpenAI’s **per-file size limit** (currently **25 MB**). Longer recordings need lower bitrate encoding, a shorter clip, or splitting/chunking (not implemented in v1).

### 3) Local environment setup for the Next.js app
1. Ensure you have a supported Node.js version installed for Next.js (and package manager: `npm` or `pnpm`).
2. In `note-recording-app/`, create `/.env.local` with (recommended names):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET_AUDIO` (this repo defaults to `recordings`)
   - `OPENAI_API_KEY`
   - (optional) `OPENAI_BASE_URL`
3. If you deploy:
   - Store these secrets in your hosting platform’s secret manager (never commit to git).

### 4) Local dev notes (waveform + audio)
1. Browser audio recording support varies by device/browser. Start with desktop Chrome/Safari.
2. Ensure your microphone input works before integrating the UI.
3. For future Bluetooth/screen-off behavior (mobile web later), verify the target browser permissions and power settings.
