"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/playback/AudioPlayer";
import { SearchableTextPane } from "@/components/text/SearchableTextPane";
import {
  fetchRecordingJson,
  postStartTranscription,
  userFacingTranscriptionError,
} from "@/lib/api/recordings";
import type { Recording } from "@/lib/types";

function rawErrorHint(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const code = typeof r.code === "string" ? r.code : null;
  const err = typeof r.error === "string" ? r.error : null;
  if (code && err) {
    return `${code}: ${err}`;
  }
  if (err) {
    return err;
  }
  return null;
}

export function RecordingDetailClient({
  projectId,
  recordingId,
  initialRecording,
}: {
  projectId: string;
  recordingId: string;
  initialRecording: Recording;
}) {
  const queryClient = useQueryClient();
  const [startError, setStartError] = useState<string | null>(null);
  const autoStartSentRef = useRef(false);

  const q = useQuery({
    queryKey: ["recording", projectId, recordingId],
    queryFn: () => fetchRecordingJson(recordingId, projectId),
    initialData: initialRecording,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === "transcription_pending") {
        return 2000;
      }
      return false;
    },
  });

  const recording = q.data ?? initialRecording;
  const recordingStatus = recording.status;

  const { mutate, isPending: startPending } = useMutation({
    mutationFn: postStartTranscription,
    onSuccess: async (result) => {
      if (!result.ok) {
        setStartError(
          userFacingTranscriptionError(result.code, result.error),
        );
        return;
      }
      setStartError(null);
      await queryClient.invalidateQueries({
        queryKey: ["recording", projectId, recordingId],
      });
    },
    onError: (e) => {
      setStartError(e instanceof Error ? e.message : "Could not start transcription");
    },
  });

  useEffect(() => {
    autoStartSentRef.current = false;
  }, [recordingId]);

  useEffect(() => {
    if (recordingStatus !== "uploaded") {
      return;
    }
    if (autoStartSentRef.current) {
      return;
    }
    autoStartSentRef.current = true;
    mutate(recordingId);
  }, [recordingStatus, recordingId, mutate]);

  const failedHint =
    recording.status === "failed" ? rawErrorHint(recording.transcription_raw) : null;

  return (
    <>
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Recording
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{recordingId}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Status:{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {recording.status}
            {q.isFetching && recording.status === "transcription_pending"
              ? " (refreshing…)"
              : ""}
          </span>
        </p>
      </header>

      {recording.status === "uploaded" && startPending ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Starting transcription…
        </p>
      ) : null}

      {recording.status === "transcription_pending" ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Transcribing audio — this may take a little while. This page updates automatically.
        </p>
      ) : null}

      {startError ? (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          <p>{startError}</p>
          {recording.status === "uploaded" ? (
            <button
              type="button"
              disabled={startPending}
              onClick={() => {
                autoStartSentRef.current = false;
                setStartError(null);
                mutate(recordingId);
              }}
              className="self-start rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {startPending ? "Retrying…" : "Retry transcription"}
            </button>
          ) : null}
        </div>
      ) : null}

      {recording.status === "failed" ? (
        <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-3 text-sm text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          <p className="font-medium">Transcription failed</p>
          {failedHint ? (
            <p className="font-mono text-xs opacity-90">{failedHint}</p>
          ) : null}
          <button
            type="button"
            disabled={startPending}
            onClick={() => {
              setStartError(null);
              mutate(recordingId);
            }}
            className="self-start rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {startPending ? "Retrying…" : "Retry transcription"}
          </button>
        </div>
      ) : null}

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Audio was uploaded from the recorder. Playback uses a signed URL from the server.
      </p>

      <AudioPlayer label="This recording" />

      <SearchableTextPane
        title="Transcript"
        body={recording.transcript_text ?? ""}
      />
    </>
  );
}
