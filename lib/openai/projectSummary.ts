import { OpenAITranscriptionError } from "@/lib/openai/transcribe";
import type { TemplatePreset } from "@/lib/projects/processingTemplate";

function systemPromptForPreset(preset: TemplatePreset): string {
  if (preset === "tasks") {
    return (
      "You maintain a running list of action items for the project (bullets, one task per line or short sub-bullets). " +
      "When a new spoken-notes transcript arrives, merge any new actionable items; dedupe near-duplicates; keep wording concise. " +
      "Output only the updated list as plain text—no preamble or title."
    );
  }
  return (
    "You maintain a concise project outline (short bullets or short paragraphs). When new spoken-notes transcript arrives, merge it into the outline. " +
    "Preserve important themes from the prior outline. Output only the updated outline text—no preamble or title."
  );
}

export async function refreshProjectSummary({
  apiKey,
  baseUrl,
  previousSummary,
  newTranscriptText,
  templatePreset = "summary",
  customInstructions,
}: {
  apiKey: string;
  baseUrl: string;
  previousSummary: string;
  /** Plain transcript for this recording (not the full master transcript). */
  newTranscriptText: string;
  templatePreset?: TemplatePreset;
  customInstructions?: string | null;
}): Promise<string> {
  const trimmedPrev = (previousSummary ?? "").trim();
  const excerpt = newTranscriptText.trim().slice(0, 14_000);
  const extra =
    typeof customInstructions === "string" && customInstructions.trim().length > 0
      ? `\n\nProject direction:\n${customInstructions.trim()}`
      : "";

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system" as const,
        content: systemPromptForPreset(templatePreset),
      },
      {
        role: "user" as const,
        content: `Previous ${templatePreset === "tasks" ? "task list" : "outline"}:\n${trimmedPrev || "(none yet)"}\n\nNew transcript:\n${excerpt || "(empty)"}${extra}\n\nReturn the updated ${templatePreset === "tasks" ? "task list" : "outline"}.`,
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
