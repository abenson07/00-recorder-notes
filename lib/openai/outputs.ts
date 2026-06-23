import { llmChatComplete } from "@/lib/llm/chatComplete";
import type { ProcessingTemplate } from "@/lib/projects/processingTemplate";

export async function upsertItemOutput({
  supabase,
  itemId,
  title,
  contentMd,
  outputType,
  locked = false,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  itemId: string;
  title: string;
  contentMd: string;
  outputType: "summary" | "tasks" | "custom";
  locked?: boolean;
}): Promise<void> {
  const { data: existing } = await supabase
    .from("outputs")
    .select("id, locked")
    .eq("scope_type", "item")
    .eq("scope_id", itemId)
    .eq("output_type", outputType)
    .maybeSingle();

  if (existing?.locked) {
    return;
  }

  if (existing?.id) {
    await supabase
      .from("outputs")
      .update({
        title,
        content_md: contentMd,
        locked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("outputs").insert({
    scope_type: "item",
    scope_id: itemId,
    title,
    content_md: contentMd,
    output_type: outputType,
    locked,
  });
}

export async function generateItemSummaryOutput({
  masterTranscript,
  template,
}: {
  masterTranscript: string;
  template: ProcessingTemplate;
  apiKey?: string;
  baseUrl?: string;
}): Promise<string> {
  const excerpt = masterTranscript.trim().slice(0, 16_000);
  const extra = template.customInstructions?.trim()
    ? `\n\nExtra direction:\n${template.customInstructions.trim()}`
    : "";

  if (template.preset === "tasks") {
    return llmChatComplete({
      messages: [
        {
          role: "system",
          content:
            "Extract all action items from these transcripts as a markdown checklist. Each task on its own line with `- [ ]`. Include brief details in parentheses when helpful.",
        },
        {
          role: "user",
          content: `Transcripts:\n${excerpt}${extra}`,
        },
      ],
    });
  }

  return llmChatComplete({
    messages: [
      {
        role: "system",
        content:
          "Write a concise summary of these combined transcripts as markdown. Use headings and bullets where appropriate.",
      },
      {
        role: "user",
        content: `Transcripts:\n${excerpt}${extra}`,
      },
    ],
  });
}

export async function refreshOpenOutputsForItem({
  supabase,
  itemId,
  masterTranscript,
  template,
}: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  itemId: string;
  masterTranscript: string;
  template: ProcessingTemplate;
  apiKey?: string;
  baseUrl?: string;
}): Promise<void> {
  const contentMd = await generateItemSummaryOutput({
    masterTranscript,
    template,
  });

  await upsertItemOutput({
    supabase,
    itemId,
    title: template.preset === "tasks" ? "Tasks" : "Summary",
    contentMd,
    outputType: template.preset === "tasks" ? "tasks" : "summary",
    locked: false,
  });
}
