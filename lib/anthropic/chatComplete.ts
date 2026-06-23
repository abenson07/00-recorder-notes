import { OpenAITranscriptionError } from "@/lib/openai/transcribe";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const ANTHROPIC_VERSION = "2023-06-01";

export async function anthropicChatComplete({
  apiKey,
  model = "claude-sonnet-4-20250514",
  temperature = 0.3,
  messages,
}: {
  apiKey: string;
  model?: string;
  temperature?: number;
  messages: ChatMessage[];
}): Promise<string> {
  const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content);
  const nonSystem = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    temperature,
    messages: nonSystem.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
  };

  if (systemParts.length > 0) {
    body.system = systemParts.join("\n\n");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
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
        "Anthropic authentication failed",
        401,
        "ANTHROPIC_UNAUTHORIZED",
      );
    }
    if (response.status === 429) {
      throw new OpenAITranscriptionError(
        "Anthropic rate limit exceeded",
        429,
        "ANTHROPIC_RATE_LIMIT",
      );
    }
    throw new OpenAITranscriptionError(
      detail.slice(0, 500) || `Anthropic chat failed (${response.status})`,
      response.status || 502,
      "ANTHROPIC_CHAT_ERROR",
    );
  }

  const content = (parsed as { content?: { type: string; text?: string }[] })?.content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}
