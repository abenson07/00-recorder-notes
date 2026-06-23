import { anthropicChatComplete } from "@/lib/anthropic/chatComplete";
import { openaiChatComplete, type ChatMessage } from "@/lib/openai/chatComplete";

export type { ChatMessage };

export type LlmChatParams = {
  messages: ChatMessage[];
  temperature?: number;
  /** OpenAI model when falling back */
  openaiModel?: string;
  /** Anthropic model when ANTHROPIC_API_KEY is set */
  anthropicModel?: string;
};

/**
 * Text completion for summaries, outputs, chat, etc.
 * Uses Anthropic when ANTHROPIC_API_KEY is set; otherwise OpenAI.
 * Transcription always uses OpenAI Whisper separately.
 */
export async function llmChatComplete({
  messages,
  temperature = 0.3,
  openaiModel = "gpt-4o-mini",
  anthropicModel = "claude-sonnet-4-20250514",
}: LlmChatParams): Promise<string> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return anthropicChatComplete({
      apiKey: anthropicKey,
      model: anthropicModel,
      temperature,
      messages,
    });
  }

  const { getServerEnv } = await import("@/lib/env");
  const env = getServerEnv();
  return openaiChatComplete({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: openaiModel,
    temperature,
    messages,
  });
}
