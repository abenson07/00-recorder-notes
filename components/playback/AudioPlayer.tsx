"use client";

import { useEffect, useState } from "react";

function AudioPlayerLoaded({
  label,
  recordingId,
  projectId,
  mimeType,
}: {
  label: string;
  recordingId: string;
  projectId?: string;
  mimeType?: string | null;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const qs = projectId
      ? `?${new URLSearchParams({ projectId }).toString()}`
      : "";

    fetch(
      `/api/recordings/${encodeURIComponent(recordingId)}/signed-audio${qs}`,
    )
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          signedUrl?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Could not load audio",
          );
        }
        if (typeof data.signedUrl !== "string") {
          throw new Error("Invalid audio response");
        }
        if (!cancelled) {
          setErr(null);
          setSrc(data.signedUrl);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSrc(null);
          setErr(e instanceof Error ? e.message : "Could not load audio");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [recordingId, projectId]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
      {loading ? (
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Loading audio…</p>
      ) : null}
      {err ? (
        <p className="mt-2 text-red-600 dark:text-red-400">{err}</p>
      ) : null}
      {src ? (
        <audio
          controls
          className="mt-3 h-10 w-full"
          src={src}
          preload="metadata"
        />
      ) : null}
      {mimeType ? (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{mimeType}</p>
      ) : null}
    </div>
  );
}

export function AudioPlayer({
  label = "Audio",
  recordingId,
  projectId,
  mimeType,
}: {
  label?: string;
  recordingId?: string;
  /** When set, the signed-audio API verifies the recording belongs to this project. */
  projectId?: string;
  mimeType?: string | null;
}) {
  if (!recordingId) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
        <p className="mt-2">No recording selected for playback.</p>
      </div>
    );
  }

  return (
    <AudioPlayerLoaded
      key={`${recordingId}:${projectId ?? ""}`}
      label={label}
      recordingId={recordingId}
      projectId={projectId}
      mimeType={mimeType}
    />
  );
}
