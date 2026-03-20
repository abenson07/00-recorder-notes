import { OpenAITranscriptionError } from "@/lib/openai/transcribe";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function openaiChatComplete({
  apiKey,
  baseUrl,
  model = "gpt-4o-mini",
  temperature = 0.3,
  messages,
}: {
  apiKey: string;
  baseUrl: string;
  model?: string;
  temperature?: number;
  messages: ChatMessage[];
}): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
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
      "OPENAI_CHAT_ERROR",
    );
  }

  const content = (parsed as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
    ?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
