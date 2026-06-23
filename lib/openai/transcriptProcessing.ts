import { llmChatComplete } from "@/lib/llm/chatComplete";

export async function analyzePurpose({
  transcriptText,
  contextMd,
  projectDescription,
}: {
  transcriptText: string;
  contextMd?: string | null;
  projectDescription?: string | null;
  /** @deprecated Unused; LLM provider comes from env */
  apiKey?: string;
  /** @deprecated Unused; LLM provider comes from env */
  baseUrl?: string;
}): Promise<string> {
  const excerpt = transcriptText.trim().slice(0, 12_000);
  const contextParts: string[] = [];
  if (projectDescription?.trim()) {
    contextParts.push(`Project purpose: ${projectDescription.trim()}`);
  }
  if (contextMd?.trim()) {
    contextParts.push(`Context:\n${contextMd.trim().slice(0, 4000)}`);
  }
  const contextBlock =
    contextParts.length > 0 ? `\n\n${contextParts.join("\n\n")}` : "";

  return llmChatComplete({
    messages: [
      {
        role: "system",
        content:
          "Summarize what this voice recording is about in 1-3 sentences. Be specific and practical.",
      },
      {
        role: "user",
        content: `Transcript:\n${excerpt || "(empty)"}${contextBlock}`,
      },
    ],
  });
}

export async function generateItemTitle({
  purposeSummary,
}: {
  purposeSummary: string;
  apiKey?: string;
  baseUrl?: string;
}): Promise<string> {
  const title = await llmChatComplete({
    messages: [
      {
        role: "system",
        content:
          "Generate a short, descriptive title (max 8 words) for this recording. Reply with the title only, no quotes.",
      },
      {
        role: "user",
        content: purposeSummary,
      },
    ],
  });
  return title.trim().slice(0, 200) || "Untitled recording";
}

export async function cleanTranscript({
  rawTranscript,
  purposeSummary,
  contextMd,
  projectDescription,
}: {
  rawTranscript: string;
  purposeSummary: string;
  contextMd?: string | null;
  projectDescription?: string | null;
  apiKey?: string;
  baseUrl?: string;
}): Promise<string> {
  const excerpt = rawTranscript.trim().slice(0, 14_000);
  const contextParts: string[] = [`Purpose: ${purposeSummary}`];
  if (projectDescription?.trim()) {
    contextParts.push(`Project: ${projectDescription.trim()}`);
  }
  if (contextMd?.trim()) {
    contextParts.push(`Context:\n${contextMd.trim().slice(0, 3000)}`);
  }

  return llmChatComplete({
    messages: [
      {
        role: "system",
        content:
          "Clean and format this transcript as readable markdown. Fix obvious transcription errors using the provided context. Preserve meaning; use paragraphs and bullet lists where helpful. Output markdown only.",
      },
      {
        role: "user",
        content: `${contextParts.join("\n\n")}\n\nRaw transcript:\n${excerpt}`,
      },
    ],
  });
}
