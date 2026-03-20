/** OpenAI Whisper per-file limit (see https://platform.openai.com/docs/guides/speech-to-text). */
export const OPENAI_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export class OpenAITranscriptionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "OpenAITranscriptionError";
  }
}

export interface TranscribeAudioParams {
  apiKey: string;
  /** Base URL including `/v1`, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
  audio: Blob;
  /** Filename with a realistic extension (e.g. `.webm`, `.wav`) for the multipart part. */
  filename: string;
  /** e.g. `whisper-1` */
  model?: string;
  language?: string;
}

export interface TranscriptionResult {
  text: string;
  raw: unknown;
}

/**
 * POST /v1/audio/transcriptions with multipart form data (Whisper).
 */
export async function transcribeAudio({
  apiKey,
  baseUrl,
  audio,
  filename,
  model = "whisper-1",
  language,
}: TranscribeAudioParams): Promise<TranscriptionResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/audio/transcriptions`;
  const form = new FormData();
  form.set("file", audio, filename);
  form.set("model", model);
  form.set("response_format", "verbose_json");
  if (language) {
    form.set("language", language);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  const bodyText = await response.text();
  let parsed: unknown;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof (parsed as { error?: { message?: string } }).error?.message === "string"
        ? (parsed as { error: { message: string } }).error.message
        : bodyText || response.statusText;

    if (response.status === 401) {
      throw new OpenAITranscriptionError("OpenAI authentication failed", 401, "OPENAI_UNAUTHORIZED");
    }
    if (response.status === 413) {
      throw new OpenAITranscriptionError(
        "Audio exceeds provider size limit",
        413,
        "OPENAI_PAYLOAD_TOO_LARGE",
      );
    }
    if (response.status === 429) {
      throw new OpenAITranscriptionError("OpenAI rate limit exceeded", 429, "OPENAI_RATE_LIMIT");
    }
    throw new OpenAITranscriptionError(
      detail.slice(0, 500) || `OpenAI request failed (${response.status})`,
      response.status || 502,
      "OPENAI_ERROR",
    );
  }

  const obj = parsed as { text?: string } | null;
  const text = typeof obj?.text === "string" ? obj.text : "";

  return { text, raw: parsed };
}
