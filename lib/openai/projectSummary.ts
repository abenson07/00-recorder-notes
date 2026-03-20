import { OpenAITranscriptionError } from "@/lib/openai/transcribe";

export async function refreshProjectSummary({
  apiKey,
  baseUrl,
  previousSummary,
  newTranscriptText,
}: {
  apiKey: string;
  baseUrl: string;
  previousSummary: string;
  /** Plain transcript for this recording (not the full master transcript). */
  newTranscriptText: string;
}): Promise<string> {
  const trimmedPrev = (previousSummary ?? "").trim();
  const excerpt = newTranscriptText.trim().slice(0, 14_000);

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system" as const,
        content:
          "You maintain a concise project outline (short bullets or short paragraphs). When new spoken-notes transcript arrives, merge it into the outline. Preserve important themes from the prior outline. Output only the updated outline text—no preamble or title.",
      },
      {
        role: "user" as const,
        content: `Previous outline:\n${trimmedPrev || "(none yet)"}\n\nNew transcript:\n${excerpt || "(empty)"}\n\nReturn the refreshed outline.`,
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
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
        : text || response.statusText;

    if (response.status === 401) {
      throw new OpenAITranscriptionError(
        "OpenAI authentication failed",
        401,
        "OPENAI_UNAUTHORIZED",
      );
    }
    if (response.status === 429) {
      throw new OpenAITranscriptionError(
        "OpenAI rate limit exceeded",
        429,
        "OPENAI_RATE_LIMIT",
      );
    }
    throw new OpenAITranscriptionError(
      detail.slice(0, 500) || `OpenAI chat failed (${response.status})`,
      response.status || 502,
      "OPENAI_SUMMARY_ERROR",
    );
  }

  const content = (parsed as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
    ?.message?.content;
  const out = typeof content === "string" ? content.trim() : "";
  return out || trimmedPrev;
}
