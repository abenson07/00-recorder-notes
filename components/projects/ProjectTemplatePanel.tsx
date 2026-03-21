"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { patchProject } from "@/lib/api/projects";
import type { ProcessingTemplate, TemplatePreset } from "@/lib/projects/processingTemplate";

export function ProjectTemplatePanel({
  projectId,
  initial,
}: {
  projectId: string;
  initial: ProcessingTemplate;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<TemplatePreset>(initial.preset);
  const [customInstructions, setCustomInstructions] = useState(
    initial.customInstructions ?? "",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      patchProject(projectId, {
        processing_template: {
          preset,
          customInstructions: customInstructions.trim() || null,
        },
      }),
    onSuccess: async () => {
      setSaveError(null);
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      router.refresh();
    },
    onError: (e) => {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    },
  });

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Direction / template
      </h2>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Applied when a recording finishes transcribing. “Tasks” expects structured JSON with a
        task list in the Output tab.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400" htmlFor="tmpl-preset">
            Output preset
          </label>
          <select
            id="tmpl-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value as TemplatePreset)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="summary">Summary (text outline)</option>
            <option value="tasks">Tasks (structured JSON)</option>
          </select>
        </div>

        <div>
          <label
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            htmlFor="tmpl-directions"
          >
            Extra instructions (optional)
          </label>
          <textarea
            id="tmpl-directions"
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={4}
            placeholder="e.g. Focus on decisions and owners…"
            className="mt-1 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
        </div>

        {saveError ? (
          <p className="text-sm text-red-700 dark:text-red-300" role="alert">
            {saveError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={isPending}
          onClick={() => mutate()}
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving…" : "Save template"}
        </button>
      </div>
    </section>
  );
}
