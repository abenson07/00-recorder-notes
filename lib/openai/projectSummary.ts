import { llmChatComplete } from "@/lib/llm/chatComplete";
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
  previousSummary,
  newTranscriptText,
  templatePreset = "summary",
  customInstructions,
}: {
  previousSummary: string;
  newTranscriptText: string;
  templatePreset?: TemplatePreset;
  customInstructions?: string | null;
  /** @deprecated Unused */
  apiKey?: string;
  /** @deprecated Unused */
  baseUrl?: string;
}): Promise<string> {
  const trimmedPrev = (previousSummary ?? "").trim();
  const excerpt = newTranscriptText.trim().slice(0, 14_000);
  const extra =
    typeof customInstructions === "string" && customInstructions.trim().length > 0
      ? `\n\nProject direction:\n${customInstructions.trim()}`
      : "";

  const out = await llmChatComplete({
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: systemPromptForPreset(templatePreset),
      },
      {
        role: "user",
        content: `Previous ${templatePreset === "tasks" ? "task list" : "outline"}:\n${trimmedPrev || "(none yet)"}\n\nNew transcript:\n${excerpt || "(empty)"}${extra}\n\nReturn the updated ${templatePreset === "tasks" ? "task list" : "outline"}.`,
      },
    ],
  });

  return out.trim() || trimmedPrev;
}
