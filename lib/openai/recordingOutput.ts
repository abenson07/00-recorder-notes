import { OpenAITranscriptionError } from "@/lib/openai/transcribe";
import { llmChatComplete } from "@/lib/llm/chatComplete";
import type { ProcessingTemplate } from "@/lib/projects/processingTemplate";
import { z } from "zod";

export const tasksOutputPayloadSchema = z.object({
  tasks: z.array(
    z.object({
      title: z.string(),
      details: z.string().optional().nullable(),
      priority: z.enum(["low", "medium", "high"]).optional().nullable(),
    }),
  ),
});

export type TasksOutputPayload = z.infer<typeof tasksOutputPayloadSchema>;

export type RecordingTemplateApplyResult =
  | {
      ok: true;
      output_summary: string;
      output_summary_json: TasksOutputPayload | null;
      output_summary_debug: null;
    }
  | {
      ok: false;
      output_summary: string;
      output_summary_json: null;
      output_summary_debug: string;
    };

async function postChatCompletionJson(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  messages: { role: "system" | "user"; content: string }[];
  responseFormatJson: boolean;
}): Promise<{ rawText: string; parsed: unknown }> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body: Record<string, unknown> = {
    model: options.model,
    temperature: options.temperature,
    messages: options.messages,
  };
  if (options.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
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
      "OPENAI_OUTPUT_ERROR",
    );
  }

  const content = (parsed as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
    ?.message?.content;
  const rawText = typeof content === "string" ? content.trim() : "";
  let inner: unknown = null;
  if (rawText) {
    try {
      inner = JSON.parse(rawText);
    } catch {
      inner = null;
    }
  }
  return { rawText, parsed: inner };
}

async function postChatCompletionText(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  messages: { role: "system" | "user"; content: string }[];
}): Promise<string> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      temperature: options.temperature,
      messages: options.messages,
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
      "OPENAI_OUTPUT_ERROR",
    );
  }

  const content = (parsed as { choices?: { message?: { content?: string } }[] })?.choices?.[0]
    ?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

export async function applyRecordingProcessingTemplate({
  template,
  transcriptText,
}: {
  template: ProcessingTemplate;
  transcriptText: string;
  /** @deprecated Unused */
  apiKey?: string;
  /** @deprecated Unused */
  baseUrl?: string;
}): Promise<RecordingTemplateApplyResult> {
  const excerpt = transcriptText.trim().slice(0, 14_000);
  const extra = template.customInstructions?.trim()
    ? `\n\nExtra direction from the project:\n${template.customInstructions.trim()}`
    : "";

  if (template.preset === "tasks") {
    const rawText = await llmChatComplete({
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            'Extract concrete action items from the transcript. Reply with JSON only (no markdown) matching this shape: {"tasks":[{"title":"string","details":"string or omit","priority":"low"|"medium"|"high" or omit}]}. Use an empty tasks array if there are none.',
        },
        {
          role: "user",
          content: `Transcript:\n${excerpt || "(empty)"}${extra}`,
        },
      ],
    });

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          parsed = null;
        }
      }
    }

    const validated = tasksOutputPayloadSchema.safeParse(parsed);
    if (validated.success) {
      const count = validated.data.tasks.length;
      return {
        ok: true,
        output_summary:
          count === 0
            ? "No action items detected for this recording."
            : `${count} task${count === 1 ? "" : "s"} extracted (see structured list).`,
        output_summary_json: validated.data,
        output_summary_debug: null,
      };
    }

    return {
      ok: false,
      output_summary:
        "Could not parse structured tasks from the model. Raw output is kept below for debugging.",
      output_summary_json: null,
      output_summary_debug: rawText || String(parsed),
    };
  }

  const outline = await llmChatComplete({
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content:
          "Write a short outline of this single recording: key points in bullets or a tight paragraph. No title line; output plain text only.",
      },
      {
        role: "user",
        content: `Transcript:\n${excerpt || "(empty)"}${extra}`,
      },
    ],
  });

  return {
    ok: true,
    output_summary: outline || "(No outline generated.)",
    output_summary_json: null,
    output_summary_debug: null,
  };
}
