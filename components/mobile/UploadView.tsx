"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  createRecordingWithUploadInstructions,
  OPENAI_MAX_AUDIO_BYTES,
  uploadRecordingBlob,
} from "@/lib/api/recording-upload";
import { createItem } from "@/lib/api/items";
import { postStartTranscription } from "@/lib/api/recordings";
import { cn } from "@/lib/cn";

type QueueItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
};

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  return "audio/webm";
}

export function UploadView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("audio/") || /\.(webm|mp3|wav|m4a|ogg)$/i.test(f.name));
      if (list.length === 0) return;

      const oversized = list.filter((f) => f.size > OPENAI_MAX_AUDIO_BYTES);
      if (oversized.length > 0) {
        setQueue([
          {
            id: "err",
            name: oversized[0].name,
            status: "error",
            error: `File exceeds ${OPENAI_MAX_AUDIO_BYTES / (1024 * 1024)} MB limit`,
          },
        ]);
        return;
      }

      setBusy(true);
      const batchId = crypto.randomUUID();
      setQueue(
        list.map((f, i) => ({
          id: `${batchId}-${i}`,
          name: f.name,
          status: "pending" as const,
        })),
      );

      try {
        const item = await createItem({ title: list[0].name.replace(/\.[^.]+$/, "") });
        let lastRecordingId: string | null = null;

        for (let i = 0; i < list.length; i += 1) {
          const file = list[i];
          const qid = `${batchId}-${i}`;
          setQueue((q) =>
            q.map((x) => (x.id === qid ? { ...x, status: "uploading" } : x)),
          );

          const mime = file.type || guessMime(file.name);
          const instructions = await createRecordingWithUploadInstructions(
            item.id,
            mime,
            file.name,
          );
          await uploadRecordingBlob(instructions, file, mime);
          lastRecordingId = instructions.recordingId;

          setQueue((q) =>
            q.map((x) => (x.id === qid ? { ...x, status: "processing" } : x)),
          );

          const result = await postStartTranscription(instructions.recordingId);
          if (!result.ok) {
            setQueue((q) =>
              q.map((x) =>
                x.id === qid ? { ...x, status: "error", error: result.error } : x,
              ),
            );
          } else {
            setQueue((q) =>
              q.map((x) => (x.id === qid ? { ...x, status: "done" } : x)),
            );
          }
        }

        await queryClient.invalidateQueries({ queryKey: ["items"] });
        if (lastRecordingId) {
          router.push(`/items/${item.id}/recordings/${lastRecordingId}`);
        } else {
          router.push(`/items/${item.id}`);
        }
      } catch (e) {
        setQueue([
          {
            id: "batch-err",
            name: "Upload",
            status: "error",
            error: e instanceof Error ? e.message : "Upload failed",
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [queryClient, router],
  );

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 md:hidden">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Upload</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Upload audio files — max {OPENAI_MAX_AUDIO_BYTES / (1024 * 1024)} MB each
        </p>
      </header>

      <div
        className={cn(
          "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 transition-colors",
          dragOver
            ? "border-orange-400 bg-orange-50/50 dark:bg-orange-950/20"
            : "border-stone-300 bg-white/60 dark:border-stone-700 dark:bg-stone-900/40",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy && e.dataTransfer.files.length) {
            void processFiles(e.dataTransfer.files);
          }
        }}
      >
        <p className="text-center text-sm text-stone-600 dark:text-stone-400">
          Drag audio files here or tap to browse
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-orange-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.webm,.mp3,.wav,.m4a,.ogg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void processFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </div>

      {queue.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {queue.map((q) => (
            <li
              key={q.id}
              className="rounded-xl border border-stone-200 bg-white/80 px-3 py-2 text-sm dark:border-stone-800 dark:bg-stone-900/80"
            >
              <span className="font-medium">{q.name}</span>
              <span className="ml-2 text-stone-500">{q.status}</span>
              {q.error ? (
                <p className="mt-1 text-red-600 dark:text-red-400">{q.error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
