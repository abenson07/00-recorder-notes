"use client";

export function ChatPanel({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Chat grounded on project{" "}
        <span className="font-mono text-zinc-800 dark:text-zinc-200">
          {projectId.slice(0, 8)}…
        </span>{" "}
        (stub — no API yet)
      </p>
      <textarea
        readOnly
        className="min-h-[120px] w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
        placeholder="Message input will connect to POST /api/projects/:projectId/chat in a later task."
      />
    </div>
  );
}
