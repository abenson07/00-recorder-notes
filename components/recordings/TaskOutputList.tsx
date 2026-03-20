import type { TasksOutputPayload } from "@/lib/openai/recordingOutput";

export function TaskOutputList({ payload }: { payload: TasksOutputPayload }) {
  if (payload.tasks.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No tasks in structured output.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {payload.tasks.map((task, i) => (
        <li
          key={`${i}-${task.title.slice(0, 24)}`}
          className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900/50"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">{task.title}</p>
            {task.priority ? (
              <span className="rounded-md bg-zinc-200 px-2 py-0.5 text-xs font-medium uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {task.priority}
              </span>
            ) : null}
          </div>
          {task.details ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {task.details}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
