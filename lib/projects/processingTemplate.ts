import { z } from "zod";

export const TEMPLATE_PRESETS = ["summary", "tasks"] as const;
export type TemplatePreset = (typeof TEMPLATE_PRESETS)[number];

const schema = z.object({
  preset: z.enum(TEMPLATE_PRESETS),
  customInstructions: z.string().max(8000).optional().nullable(),
});

export type ProcessingTemplate = z.infer<typeof schema>;

export const DEFAULT_PROCESSING_TEMPLATE: ProcessingTemplate = {
  preset: "summary",
  customInstructions: null,
};

export function parseProcessingTemplate(raw: unknown): ProcessingTemplate {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_PROCESSING_TEMPLATE };
  }
  const p = schema.safeParse(raw);
  if (!p.success) {
    return { ...DEFAULT_PROCESSING_TEMPLATE };
  }
  return {
    preset: p.data.preset,
    customInstructions:
      typeof p.data.customInstructions === "string"
        ? p.data.customInstructions.trim() || null
        : null,
  };
}

export function processingTemplateForDb(t: ProcessingTemplate): Record<string, unknown> {
  return {
    preset: t.preset,
    customInstructions: t.customInstructions ?? null,
  };
}
