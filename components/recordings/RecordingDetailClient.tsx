"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { TabBar } from "@/components/common/TabBar";
import { AudioPlayer } from "@/components/playback/AudioPlayer";
import { SearchableTextPane } from "@/components/text/SearchableTextPane";
import {
  fetchRecordingJson,
  postStartTranscription,
  userFacingTranscriptionError,
} from "@/lib/api/recordings";
import { recordingStatusLabel } from "@/lib/recording-status";
import type { Recording } from "@/lib/types";

const OUTPUT_TABS = [
  { id: "summary", label: "Output / Summary" },
  { id: "transcript", label: "Transcript" },
];

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

function formatDurationMs(ms: number | null): string | null {
  if (ms == null || ms < 0) {
    return null;
  }
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function outputSummaryBody(recording: Recording): string {
  const o = recording.output_summary?.trim();
  if (o) {
    return o;
  }
  const t = recording.transcript_text?.trim();
  if (t) {
    const clip = t.slice(0, 600);
    return `No dedicated output summary yet. Transcript preview:\n\n${clip}${t.length > 600 ? "…" : ""}`;
  }
  return "";
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
  const [activeTab, setActiveTab] = useState("summary");
  const [searchQuery, setSearchQuery] = useState("");
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

  const summaryPaneBody = useMemo(
    () => outputSummaryBody(recording),
    [recording],
  );

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

  const durationLabel = formatDurationMs(recording.duration_ms);

  return (
    <>
      <header>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Recording
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{recordingId}</p>
      </header>

      <dl className="grid gap-2 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Created
          </dt>
          <dd className="text-zinc-900 dark:text-zinc-100">
            <time dateTime={recording.created_at}>
              {formatCreatedAt(recording.created_at)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Status
          </dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {recordingStatusLabel(recording.status)}
            {q.isFetching && recording.status === "transcription_pending"
              ? " (refreshing…)"
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Audio type
          </dt>
          <dd className="text-zinc-900 dark:text-zinc-100">
            {recording.audio_mime_type}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Duration
          </dt>
          <dd className="text-zinc-900 dark:text-zinc-100">
            {durationLabel ?? "—"}
          </dd>
        </div>
      </dl>

      {recording.status === "uploaded" && startPending ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Starting transcription…
        </p>
      ) : null}

      {recording.status === "transcription_pending" ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          Transcribing audio — this may take a little while. This page updates
          automatically.
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

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <label className="sr-only" htmlFor="recording-pane-search">
            Search output and transcript
          </label>
          <input
            id="recording-pane-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in Output / Transcript…"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30"
            autoComplete="off"
          />
        </div>
        <TabBar tabs={OUTPUT_TABS} activeId={activeTab} onChange={setActiveTab} />
        <div className="min-h-[240px] flex-1 overflow-auto p-4">
          {activeTab === "summary" ? (
            <SearchableTextPane
              body={summaryPaneBody}
              searchQuery={searchQuery}
              emptyMessage="— No output summary or transcript yet —"
            />
          ) : null}
          {activeTab === "transcript" ? (
            <SearchableTextPane
              body={recording.transcript_text ?? ""}
              searchQuery={searchQuery}
              emptyMessage="— No transcript yet —"
            />
          ) : null}
        </div>
      </section>

      <AudioPlayer
        label="This recording"
        recordingId={recordingId}
        projectId={projectId}
        mimeType={recording.audio_mime_type}
      />
    </>
  );
}
