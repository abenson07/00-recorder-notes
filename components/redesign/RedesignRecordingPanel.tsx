"use client";

import { useGSAP } from "@gsap/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsapFadeDurations } from "@/lib/gsap/fadeDurations";
import { registerGsapPlugins } from "@/lib/gsap/register-plugins";
import { AudioPlayer } from "@/components/playback/AudioPlayer";
import { TaskOutputList } from "@/components/recordings/TaskOutputList";
import { SearchableTextPane } from "@/components/text/SearchableTextPane";
import { tasksOutputPayloadSchema } from "@/lib/openai/recordingOutput";
import {
  fetchRecordingJson,
  postStartTranscription,
  userFacingTranscriptionError,
} from "@/lib/api/recordings";
import { recordingStatusLabel } from "@/lib/recording-status";
import type { Recording } from "@/lib/types";
import type { RecordingTabId } from "@/components/redesign/urlState";
import { cn } from "@/lib/cn";

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

function rawTranscriptBody(recording: Recording): string {
  if (recording.transcription_raw != null) {
    try {
      return typeof recording.transcription_raw === "string"
        ? recording.transcription_raw
        : JSON.stringify(recording.transcription_raw, null, 2);
    } catch {
      return String(recording.transcription_raw);
    }
  }
  return recording.transcript_text?.trim() ?? "";
}

const TOP_TABS: { id: RecordingTabId; label: string }[] = [
  { id: "artifacts", label: "Artifacts" },
  { id: "formatted", label: "Formatted" },
  { id: "raw", label: "Raw" },
];

export function RedesignRecordingPanel({
  projectId,
  recordingId,
  initialRecording = null,
  recordingTab,
  onRecordingTabChange,
}: {
  projectId: string;
  recordingId: string;
  initialRecording?: Recording | null;
  recordingTab: RecordingTabId;
  onRecordingTabChange: (tab: RecordingTabId) => void;
}) {
  const queryClient = useQueryClient();
  const [startError, setStartError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const autoStartSentRef = useRef(false);
  const tabScrollRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const isFirstTabPaint = useRef(true);
  const latestTabRef = useRef(recordingTab);
  latestTabRef.current = recordingTab;

  const [displayTab, setDisplayTab] = useState(recordingTab);

  const tabIndex = TOP_TABS.findIndex((x) => x.id === recordingTab);
  const tabIndicatorLeftPct =
    (Math.max(0, tabIndex) / TOP_TABS.length) * 100;

  /** Runs before `useGSAP` layout work so `isFirstTabPaint` is not reset after the first fade-in. */
  useLayoutEffect(() => {
    setDisplayTab(recordingTab);
    isFirstTabPaint.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when switching recordings
  }, [recordingId]);

  useGSAP(
    () => {
      registerGsapPlugins();
      const el = tabIndicatorRef.current;
      if (!el) {
        return;
      }
      const { in: d } = gsapFadeDurations();
      gsap.to(el, {
        left: `${tabIndicatorLeftPct}%`,
        duration: d,
        ease: "power2.inOut",
      });
    },
    { dependencies: [tabIndicatorLeftPct], scope: tabIndicatorRef },
  );

  useGSAP(
    () => {
      registerGsapPlugins();
      const el = tabContentRef.current;
      if (!el) {
        return;
      }
      const { out: dOut, in: dIn } = gsapFadeDurations();

      if (recordingTab !== displayTab) {
        gsap.to(el, {
          opacity: 0,
          duration: dOut,
          ease: "power2.in",
          onComplete: () => setDisplayTab(latestTabRef.current),
        });
        return;
      }

      if (isFirstTabPaint.current) {
        isFirstTabPaint.current = false;
        if (dIn === 0) {
          gsap.set(el, { opacity: 1 });
        } else {
          gsap.fromTo(
            el,
            { opacity: 0 },
            { opacity: 1, duration: dIn, ease: "power2.out" },
          );
        }
        return;
      }

      if (dIn === 0) {
        gsap.set(el, { opacity: 1 });
      } else {
        gsap.fromTo(
          el,
          { opacity: 0 },
          { opacity: 1, duration: dIn, ease: "power2.out" },
        );
      }
    },
    { dependencies: [recordingTab, displayTab], scope: tabContentRef },
  );

  const q = useQuery({
    queryKey: ["recording", projectId, recordingId],
    queryFn: () => fetchRecordingJson(recordingId, projectId),
    initialData: initialRecording ?? undefined,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) {
        return false;
      }
      if (d.status === "transcription_pending") {
        return 2000;
      }
      if (
        d.segments?.some(
          (s) => s.status === "transcription_pending" || s.status === "uploaded",
        )
      ) {
        return 2000;
      }
      return false;
    },
  });

  const recording = q.data ?? initialRecording ?? null;

  const tasksPayload = useMemo(() => {
    if (!recording) {
      return null;
    }
    const parsed = tasksOutputPayloadSchema.safeParse(recording.output_summary_json);
    return parsed.success ? parsed.data : null;
  }, [recording]);

  const summaryPaneBody = useMemo(() => {
    if (!recording) {
      return "";
    }
    return outputSummaryBody(recording);
  }, [recording]);

  const { mutate, isPending: startPending } = useMutation({
    mutationFn: postStartTranscription,
    onSuccess: async (result) => {
      if (!result.ok) {
        setStartError(userFacingTranscriptionError(result.code, result.error));
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
    if (!recording || recording.status !== "uploaded") {
      return;
    }
    if (autoStartSentRef.current) {
      return;
    }
    autoStartSentRef.current = true;
    mutate(recordingId);
  }, [recording, recordingId, mutate]);

  /** Re-invoke start-transcription while parent is pending so server can recover stuck segment rows. */
  useEffect(() => {
    if (recording?.status !== "transcription_pending") {
      return;
    }
    const rid = recordingId;
    const id = window.setInterval(() => {
      mutate(rid);
    }, 25_000);
    return () => clearInterval(id);
  }, [recording?.status, recordingId, mutate]);

  const failedHint =
    recording?.status === "failed" ? rawErrorHint(recording.transcription_raw) : null;

  if (!recording) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-400">
        Loading recording…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        ref={tabScrollRef}
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x" }}
      >
        {TOP_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onRecordingTabChange(t.id)}
            className={cn(
              "snap-center shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              recordingTab === t.id
                ? "bg-white/15 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        className="relative mb-1 h-0.5 overflow-hidden rounded-full bg-white/10"
        aria-hidden
      >
        <div
          ref={tabIndicatorRef}
          className="absolute bottom-0 top-0 rounded-full bg-sky-400/90"
          style={{ width: `${100 / TOP_TABS.length}%` }}
        />
      </div>

      {recording.status === "uploaded" && startPending ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          Starting transcription…
        </p>
      ) : null}

      {recording.status === "transcription_pending" ? (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">
          Transcribing — {recordingStatusLabel(recording.status)}
          {q.isFetching ? " (updating…)" : ""}
        </p>
      ) : null}

      {startError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
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
              className="mt-2 text-xs font-medium underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {recording.status === "failed" ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          <p className="font-medium">Transcription failed</p>
          {failedHint ? <p className="mt-1 font-mono text-xs opacity-90">{failedHint}</p> : null}
          <button
            type="button"
            disabled={startPending}
            onClick={() => {
              setStartError(null);
              mutate(recordingId);
            }}
            className="mt-2 text-xs font-medium underline"
          >
            Retry
          </button>
        </div>
      ) : null}

      <label className="sr-only" htmlFor="redesign-recording-search">
        Search in recording content
      </label>
      <input
        id="redesign-recording-search"
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search…"
        autoComplete="off"
        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
      />

      <div className="min-h-[200px] flex-1 overflow-auto">
        <div ref={tabContentRef} className="flex flex-col gap-4 pb-4">
          {displayTab === "artifacts" ? (
            <p className="text-sm text-slate-400">No artifacts yet.</p>
          ) : null}
          {displayTab === "formatted" ? (
            <>
              {tasksPayload ? <TaskOutputList payload={tasksPayload} /> : null}
              {recording.output_summary_debug ? (
                <details className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <summary className="cursor-pointer text-xs font-medium">
                    Structured output did not validate
                  </summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                    {recording.output_summary_debug}
                  </pre>
                </details>
              ) : null}
              <SearchableTextPane
                body={summaryPaneBody}
                searchQuery={searchQuery}
                emptyMessage="— No formatted output yet —"
              />
            </>
          ) : null}
          {displayTab === "raw" ? (
            <SearchableTextPane
              body={rawTranscriptBody(recording)}
              searchQuery={searchQuery}
              emptyMessage="— No raw transcript yet —"
            />
          ) : null}
        </div>
      </div>

      <AudioPlayer
        label="This recording"
        recordingId={recordingId}
        projectId={projectId}
        mimeType={recording.audio_mime_type}
      />
    </div>
  );
}
