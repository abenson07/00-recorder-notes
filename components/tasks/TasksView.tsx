"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RecordModal } from "@/components/record/RecordModal";
import { RecordButton } from "@/components/record/RecordButton";
import { createPlaceholderItem } from "@/lib/api/items";
import { extractTasksFromRecording, fetchTasks, toggleTaskComplete } from "@/lib/api/tasks";
import {
  fetchRecordingStatus,
  postStartTranscription,
} from "@/lib/api/recordings";
import { cn } from "@/lib/cn";

export function TasksView() {
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordItemId, setRecordItemId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", showCompleted],
    queryFn: () => fetchTasks({ completed: showCompleted ? undefined : false }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      toggleTaskComplete(id, completed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const beginVoiceCapture = async () => {
    setCreating(true);
    try {
      const id = await createPlaceholderItem();
      setRecordItemId(id);
      setRecordOpen(true);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 md:hidden">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Tasks</h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Talk to capture tasks, then check them off
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCompleted((v) => !v)}
          className="shrink-0 text-xs font-medium text-orange-700 dark:text-orange-400"
        >
          {showCompleted ? "Hide done" : "Show done"}
        </button>
      </header>

      {isLoading ? (
        <p className="text-sm text-stone-500">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            No tasks yet. Tap the mic and say what you need to do.
          </p>
          <RecordButton
            variant="fab"
            label="Add tasks"
            onClick={() => void beginVoiceCapture()}
            disabled={creating}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-24">
          {tasks.map((task) => {
            const done = Boolean(task.completed_at);
            return (
              <li
                key={task.id}
                className={cn(
                  "flex gap-3 rounded-2xl border border-stone-200/80 bg-white/80 p-4 dark:border-stone-800 dark:bg-stone-900/80",
                  done && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  checked={done}
                  disabled={toggleMutation.isPending}
                  onChange={() =>
                    toggleMutation.mutate({ id: task.id, completed: !done })
                  }
                  className="mt-1 h-5 w-5 rounded border-stone-300 accent-orange-600"
                  aria-label={`Mark "${task.title}" complete`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-medium text-stone-900 dark:text-stone-50",
                      done && "line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  {task.details ? (
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                      {task.details}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tasks.length > 0 ? (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center md:hidden">
          <RecordButton
            variant="fab"
            label="Add tasks"
            onClick={() => void beginVoiceCapture()}
            disabled={creating}
          />
        </div>
      ) : null}

      <RecordModal
        open={recordOpen}
        itemId={recordItemId}
        onOpenChange={(next) => {
          setRecordOpen(next);
          if (!next) setRecordItemId(null);
        }}
        onUploaded={async (recordingId) => {
          setRecordOpen(false);
          const iid = recordItemId;
          setRecordItemId(null);
          try {
            await postStartTranscription(recordingId);
            for (let i = 0; i < 60; i += 1) {
              await new Promise((r) => setTimeout(r, 2000));
              const status = await fetchRecordingStatus(recordingId, iid ?? "");
              if (status?.status === "transcribed") break;
              if (status?.status === "failed") break;
            }
            await extractTasksFromRecording(recordingId);
            await queryClient.invalidateQueries({ queryKey: ["tasks"] });
          } catch {
            // user can retry from item page
          }
          if (iid) {
            void queryClient.invalidateQueries({ queryKey: ["items"] });
          }
        }}
      />
    </div>
  );
}
