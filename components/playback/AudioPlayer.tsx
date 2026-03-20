export function AudioPlayer({ label = "Audio" }: { label?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
      <p className="mt-2">Playback controls (stub)</p>
    </div>
  );
}
