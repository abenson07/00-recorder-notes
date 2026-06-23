import type { Recording, RecordingStatus } from "@/lib/types";

/**
 * Absolute origin for fetch() when `window` is undefined (e.g. client component SSR).
 * Must not import `next/headers` — this module is also bundled for the browser.
 */
function apiOriginForServerFetch(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "").trim();
  if (site) {
    return site;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel}`;
  }
  return "http://localhost:3000";
}

export interface RecordingPollResult {
  id: string;
  status: RecordingStatus;
  transcript_text: string | null;
  output_summary: string | null;
}

function isRecordingRow(value: unknown): value is Recording {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const r = value as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.status === "string";
}

export type FetchRecordingJsonOptions = {
  /**
   * When running in a Server Component, pass the same origin as other server fetches
   * (e.g. from `getAppOrigin()`). Otherwise this module falls back to
   * `NEXT_PUBLIC_SITE_URL` / `VERCEL_URL` / `http://localhost:3000`, which breaks when
   * `next dev` uses another port (e.g. 3002).
   */
  serverOrigin?: string;
};

/** Browser or server: load a single recording row. */
export async function fetchRecordingJson(
  recordingId: string,
  projectId: string,
  options?: FetchRecordingJsonOptions,
): Promise<Recording | null> {
  const qs = new URLSearchParams({ itemId: projectId });
  const path = `/api/recordings/${encodeURIComponent(recordingId)}?${qs.toString()}`;
  const serverBase =
    options?.serverOrigin?.replace(/\/$/, "").trim() || undefined;
  const url =
    typeof window === "undefined"
      ? `${serverBase ?? apiOriginForServerFetch()}${path}`
      : path;

  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    console.error("[fetchRecordingJson]", res.status, await res.text());
    return null;
  }
  const data: unknown = await res.json();
  return isRecordingRow(data) ? data : null;
}

export async function fetchRecordingStatus(
  recordingId: string,
  projectId: string,
  options?: FetchRecordingJsonOptions,
): Promise<RecordingPollResult | null> {
  const row = await fetchRecordingJson(recordingId, projectId, options);
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    status: row.status,
    transcript_text: row.transcript_text,
    output_summary: row.output_summary,
  };
}

export async function fetchRecording(
  projectId: string,
  recordingId: string,
  options?: FetchRecordingJsonOptions,
): Promise<Recording | null> {
  return fetchRecordingJson(recordingId, projectId, options);
}

export type StartTranscriptionResult =
  | { ok: true; idempotent?: boolean; pendingConflict?: boolean }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
    };

export async function postStartTranscription(
  recordingId: string,
): Promise<StartTranscriptionResult> {
  const res = await fetch(
    `/api/recordings/${encodeURIComponent(recordingId)}/start-transcription`,
    { method: "POST" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    idempotent?: boolean;
  };

  if (res.ok) {
    return { ok: true, idempotent: Boolean(data.idempotent) };
  }

  if (res.status === 409 && data.code === "TRANSCRIPTION_PENDING") {
    return { ok: true, pendingConflict: true };
  }

  return {
    ok: false,
    status: res.status,
    error: typeof data.error === "string" ? data.error : "Transcription failed",
    code: typeof data.code === "string" ? data.code : undefined,
  };
}

export function userFacingTranscriptionError(
  code: string | undefined,
  fallback: string,
): string {
  switch (code) {
    case "OPENAI_UNAUTHORIZED":
      return "OpenAI rejected the API key. Check server configuration (OPENAI_API_KEY).";
    case "OPENAI_RATE_LIMIT":
      return "OpenAI rate limit reached. Wait a minute and try again.";
    case "OPENAI_PAYLOAD_TOO_LARGE":
    case "AUDIO_TOO_LARGE":
      return "This recording is too large to transcribe in one request. Try a shorter clip or lower quality.";
    case "STORAGE_DOWNLOAD":
      return "Could not load the audio file from storage.";
    case "NO_ITEM":
    case "NO_PROJECT":
      return "This recording is not linked to an item.";
    default:
      return fallback;
  }
}
