"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createRecordingWithUploadInstructions,
  uploadRecordingBlob,
} from "@/lib/api/recording-upload";

const FALLBACK_AUDIO_MIME = "audio/webm";

export function UploadModal({
  open,
  projectId,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
  onUploaded: (recordingId: string) => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setIsUploading(false);
      setErrorMessage(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isUploading, onOpenChange, open]);

  const selectedLabel = useMemo(() => {
    if (!file) {
      return "No file selected";
    }
    const mb = file.size / (1024 * 1024);
    return `${file.name} (${mb.toFixed(2)} MB)`;
  }, [file]);

  if (!open || !projectId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close upload dialog"
        onClick={() => {
          if (!isUploading) {
            onOpenChange(false);
          }
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-dialog-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
      >
        <h2
          id="upload-dialog-title"
          className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Upload recording
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Choose an audio file and we will process it the same way as a recorded note.
        </p>

        {errorMessage ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            {errorMessage}
          </p>
        ) : null}

        <div className="space-y-3">
          <label
            htmlFor="audio-upload-input"
            className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
          >
            Audio file
          </label>
          <input
            id="audio-upload-input"
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.aac,.flac"
            disabled={isUploading}
            onChange={(e) => {
              const next = e.currentTarget.files?.[0] ?? null;
              setFile(next);
              setErrorMessage(null);
            }}
            className="block w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:file:bg-zinc-200 dark:file:text-zinc-900 dark:hover:file:bg-zinc-300"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{selectedLabel}</p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!file || isUploading}
            onClick={async () => {
              if (!file) {
                setErrorMessage("Select an audio file first.");
                return;
              }
              setIsUploading(true);
              setErrorMessage(null);
              try {
                const audioMimeType = file.type?.trim() || FALLBACK_AUDIO_MIME;
                const instructions = await createRecordingWithUploadInstructions(
                  projectId,
                  audioMimeType,
                );
                await uploadRecordingBlob(instructions, file, audioMimeType);
                await onUploaded(instructions.recordingId);
              } catch (e) {
                setErrorMessage(
                  e instanceof Error ? e.message : "Could not upload audio file.",
                );
              } finally {
                setIsUploading(false);
              }
            }}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
