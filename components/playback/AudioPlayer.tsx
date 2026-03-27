"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PlaylistSegment = {
  segmentId: string;
  position: number;
  signedUrl: string;
  mimeType: string;
};

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
  const [segments, setSegments] = useState<PlaylistSegment[]>([]);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const qsBase = projectId
      ? `?${new URLSearchParams({ projectId }).toString()}`
      : "";

    const load = async () => {
      const playlistRes = await fetch(
        `/api/recordings/${encodeURIComponent(recordingId)}/signed-playlist${qsBase}`,
      );
      const playlistData = (await playlistRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        segments?: PlaylistSegment[];
      };

      if (!cancelled && playlistRes.ok && Array.isArray(playlistData.segments)) {
        setSegments(playlistData.segments);
        setLoading(false);
        return;
      }

      if (
        !cancelled &&
        playlistRes.status === 404 &&
        playlistData.code === "NO_SEGMENTS"
      ) {
        const singleQs = projectId
          ? `?${new URLSearchParams({ projectId }).toString()}`
          : "";
        const singleRes = await fetch(
          `/api/recordings/${encodeURIComponent(recordingId)}/signed-audio${singleQs}`,
        );
        const singleData = (await singleRes.json().catch(() => ({}))) as {
          error?: string;
          signedUrl?: string;
        };
        if (!singleRes.ok) {
          throw new Error(
            typeof singleData.error === "string"
              ? singleData.error
              : "Could not load audio",
          );
        }
        if (typeof singleData.signedUrl !== "string") {
          throw new Error("Invalid audio response");
        }
        if (!cancelled) {
          setFallbackUrl(singleData.signedUrl);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        throw new Error(
          typeof playlistData.error === "string"
            ? playlistData.error
            : "Could not load audio",
        );
      }
    };

    void load().catch((e) => {
      if (!cancelled) {
        setSegments([]);
        setFallbackUrl(null);
        setErr(e instanceof Error ? e.message : "Could not load audio");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [recordingId, projectId]);

  const prefetchUrl = useCallback((url: string) => {
    if (prefetchedRef.current.has(url)) {
      return;
    }
    prefetchedRef.current.add(url);
    const a = new Audio();
    a.preload = "auto";
    a.src = url;
  }, []);

  useEffect(() => {
    if (segments.length === 0) {
      return;
    }
    const next = segments[activeIndex + 1];
    if (next?.signedUrl) {
      prefetchUrl(next.signedUrl);
    }
  }, [segments, activeIndex, prefetchUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) {
      return;
    }
    if (fallbackUrl) {
      el.src = fallbackUrl;
      return;
    }
    const seg = segments[activeIndex];
    if (seg?.signedUrl) {
      el.src = seg.signedUrl;
    }
  }, [segments, activeIndex, fallbackUrl]);

  const partLabel =
    segments.length > 1
      ? `${label} (part ${activeIndex + 1} of ${segments.length})`
      : label;

  const displayMime =
    segments.length > 0
      ? (segments[activeIndex]?.mimeType ?? mimeType)
      : mimeType;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">{partLabel}</p>
      {loading ? (
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Loading audio…</p>
      ) : null}
      {err ? (
        <p className="mt-2 text-red-600 dark:text-red-400">{err}</p>
      ) : null}
      {!loading && !err && (fallbackUrl || segments.length > 0) ? (
        <audio
          ref={audioRef}
          controls
          className="mt-3 h-10 w-full"
          preload="metadata"
          onEnded={() => {
            if (segments.length > 0 && activeIndex + 1 < segments.length) {
              setActiveIndex((i) => i + 1);
            }
          }}
        />
      ) : null}
      {displayMime ? (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{displayMime}</p>
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
  recordingId: string;
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
