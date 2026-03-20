import Link from "next/link";
import type { RecordingListItem } from "@/lib/types";
import {
  recordingStatusBadgeClass,
  recordingStatusLabel,
} from "@/lib/recording-status";

function formatCreatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function RecordingsList({
  projectId,
  items,
}: {
  projectId: string;
  items: RecordingListItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No recordings yet. Use the center Record button to add one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={`/projects/${projectId}/recordings/${r.id}`}
            className="block py-4 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              <time
                className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
                dateTime={r.created_at}
              >
                {formatCreatedAt(r.created_at)}
              </time>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${recordingStatusBadgeClass(r.status)}`}
              >
                {recordingStatusLabel(r.status)}
              </span>
            </div>
            {r.preview ? (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                {r.preview}
              </p>
            ) : (
              <p className="mt-1 text-sm italic text-zinc-400 dark:text-zinc-500">
                No preview yet
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
