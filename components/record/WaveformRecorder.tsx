"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRecordingWithUploadInstructions,
  uploadRecordingBlob,
} from "@/lib/api/recording-upload";
import { cn } from "@/lib/cn";

type Phase = "idle" | "recording" | "paused" | "ready_to_save" | "uploading" | "error";

function pickRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return "";
}

const CAN_PAUSE_RECORDER =
  typeof MediaRecorder !== "undefined" &&
  typeof MediaRecorder.prototype.pause === "function" &&
  typeof MediaRecorder.prototype.resume === "function";

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function userFacingMicError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Microphone access was blocked. Allow the mic for this site in your browser settings, then try again.";
    }
    if (err.name === "NotFoundError") {
      return "No microphone was found. Plug one in or pick an input in system settings.";
    }
  }
  return "Could not open the microphone. Check permissions and try again.";
}

export function WaveformRecorder({
  itemId: itemIdProp,
  projectId,
  onComplete,
  onRequestClose,
  className,
}: {
  itemId?: string;
  /** @deprecated Use itemId */
  projectId?: string;
  onComplete: (recordingId: string) => void;
  onRequestClose: () => void;
  className?: string;
}) {
  const itemId = itemIdProp ?? projectId ?? "";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/webm");
  const rafRef = useRef<number | null>(null);

  const segmentStartedAtRef = useRef<number>(0);
  const accumulatedMsRef = useRef(0);

  const draftBlobRef = useRef<Blob | null>(null);
  const draftMimeRef = useRef<string>("audio/webm");
  const instructionsRef = useRef<Awaited<
    ReturnType<typeof createRecordingWithUploadInstructions>
  > | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Set when a stop produced a non-empty blob (used for retry UI; avoid reading refs during render). */
  const [hasDraftBlob, setHasDraftBlob] = useState(false);

  const stopVisualization = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const teardownCapture = useCallback(() => {
    stopVisualization();
    mediaRecorderRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopVisualization]);

  useEffect(() => () => teardownCapture(), [teardownCapture]);

  const startVisualization = useCallback(() => {
    const tick = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      if (!canvas || !analyser) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const bufferLength = analyser.frequencyBinCount;
      const data = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(data);

      ctx.fillStyle =
        typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "#18181b"
          : "#fafafa";
      ctx.fillRect(0, 0, w, h);

      const barCount = 48;
      const step = Math.max(1, Math.floor(bufferLength / barCount));
      const barWidth = w / barCount - 1;

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += data[i * step + j] ?? 0;
        }
        const avg = sum / step;
        const norm = avg / 255;
        const barHeight = Math.max(3, norm * h * 0.9);
        const x = i * (barWidth + 1);
        const y = h - barHeight;
        ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
        ctx.fillRect(x, y, barWidth - 0.5, barHeight);
      }

      if (mediaRecorderRef.current?.state === "recording") {
        const seg = performance.now() - segmentStartedAtRef.current;
        setElapsedMs(accumulatedMsRef.current + seg);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    stopVisualization();
    rafRef.current = requestAnimationFrame(tick);
  }, [stopVisualization]);

  const startTimingSegment = useCallback(() => {
    segmentStartedAtRef.current = performance.now();
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setHasDraftBlob(false);
    draftBlobRef.current = null;
    instructionsRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mime = pickRecorderMimeType();
      mimeRef.current = mime || "audio/webm";
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      if (recorder.mimeType) {
        mimeRef.current = recorder.mimeType;
      }

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      accumulatedMsRef.current = 0;
      startTimingSegment();
      setElapsedMs(0);
      setPhase("recording");

      startVisualization();
    } catch (e) {
      teardownCapture();
      setErrorMessage(userFacingMicError(e));
      setPhase("error");
    }
  }, [startVisualization, startTimingSegment, teardownCapture]);

  const pauseRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== "recording") {
      return;
    }
    rec.pause();
    accumulatedMsRef.current += performance.now() - segmentStartedAtRef.current;
    setElapsedMs(accumulatedMsRef.current);
    setPhase("paused");
  }, []);

  const resumeRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state !== "paused") {
      return;
    }
    rec.resume();
    startTimingSegment();
    setPhase("recording");
  }, [startTimingSegment]);

  const finalizeStop = useCallback(async () => {
    const rec = mediaRecorderRef.current;
    const stream = streamRef.current;
    if (!rec) {
      return;
    }

    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      if (rec.state !== "inactive") {
        rec.stop();
      } else {
        resolve();
      }
    });

    stopVisualization();

    void stream?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;

    const mime = mimeRef.current || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];

    if (!blob.size) {
      setHasDraftBlob(false);
      setErrorMessage("No audio was captured. Try recording a bit longer.");
      setPhase("error");
      return;
    }

    draftBlobRef.current = blob;
    draftMimeRef.current = blob.type || mime;
    setHasDraftBlob(true);
    setPhase("ready_to_save");
  }, [stopVisualization]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") {
      return;
    }
    if (rec.state === "recording") {
      accumulatedMsRef.current += performance.now() - segmentStartedAtRef.current;
      setElapsedMs(accumulatedMsRef.current);
    }
    void finalizeStop();
  }, [finalizeStop]);

  const runUpload = useCallback(async () => {
    const blob = draftBlobRef.current;
    const mime = draftMimeRef.current;
    if (!blob) {
      setErrorMessage("Nothing to save. Record again.");
      setPhase("error");
      return;
    }

    setPhase("uploading");
    setErrorMessage(null);

    try {
      let instructions = instructionsRef.current;
      if (!instructions) {
        instructions = await createRecordingWithUploadInstructions(itemId, mime);
        instructionsRef.current = instructions;
      }
      await uploadRecordingBlob(instructions, blob, mime);
      onComplete(instructions.recordingId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setErrorMessage(msg);
      setPhase("error");
    }
  }, [onComplete, itemId]);

  const resetAll = useCallback(() => {
    teardownCapture();
    chunksRef.current = [];
    draftBlobRef.current = null;
    instructionsRef.current = null;
    accumulatedMsRef.current = 0;
    segmentStartedAtRef.current = 0;
    setElapsedMs(0);
    setErrorMessage(null);
    setHasDraftBlob(false);
    setPhase("idle");
  }, [teardownCapture]);

  const onRetryUpload = useCallback(() => {
    if (!hasDraftBlob) {
      void startRecording();
      return;
    }
    void runUpload();
  }, [hasDraftBlob, runUpload, startRecording]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        aria-live="polite"
      >
        <canvas
          ref={canvasRef}
          className="h-20 w-full"
          aria-hidden
        />
        <div className="absolute right-3 top-2 rounded-md bg-zinc-900/75 px-2 py-0.5 font-mono text-xs text-zinc-100 tabular-nums dark:bg-zinc-950/85">
          {formatElapsed(elapsedMs)}
        </div>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {phase === "idle" || phase === "error" ? (
          <button
            type="button"
            onClick={() => {
              resetAll();
              void startRecording();
            }}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {phase === "error" && hasDraftBlob ? "Record again" : "Start"}
          </button>
        ) : null}

        {phase === "recording" && CAN_PAUSE_RECORDER ? (
          <button
            type="button"
            onClick={pauseRecording}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Pause
          </button>
        ) : null}

        {phase === "paused" && CAN_PAUSE_RECORDER ? (
          <button
            type="button"
            onClick={resumeRecording}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Resume
          </button>
        ) : null}

        {(phase === "recording" || phase === "paused") && !CAN_PAUSE_RECORDER ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Pause/resume is not supported in this browser — use Stop when you are done.
          </p>
        ) : null}

        {phase === "recording" || phase === "paused" ? (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Stop
          </button>
        ) : null}

        {phase === "ready_to_save" ? (
          <>
            <button
              type="button"
              onClick={() => void runUpload()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Save
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-lg border border-zinc-300 bg-transparent px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Discard
            </button>
          </>
        ) : null}

        {phase === "uploading" ? (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Uploading…</span>
        ) : null}

        {phase === "error" && hasDraftBlob ? (
          <button
            type="button"
            onClick={() => void onRetryUpload()}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
          >
            Retry upload
          </button>
        ) : null}
      </div>

      <div className="flex justify-end border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            teardownCapture();
            onRequestClose();
          }}
          className="text-sm text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}
