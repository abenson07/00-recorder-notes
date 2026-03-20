export function SearchableTextPane({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const display = body.trim() || "— No content yet (stub) —";

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {display}
        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          Search / highlight (stub)
        </p>
      </div>
    </div>
  );
}
