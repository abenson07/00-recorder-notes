import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h2>
      {description ? (
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}
