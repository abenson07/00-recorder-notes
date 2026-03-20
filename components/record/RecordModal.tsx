"use client";

import { useEffect } from "react";
import { WaveformRecorder } from "@/components/record/WaveformRecorder";

export function RecordModal({
  open,
  projectId,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
  onUploaded: (recordingId: string) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !projectId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close recording dialog"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-dialog-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl"
      >
        <h2
          id="record-dialog-title"
          className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          New recording
        </h2>
        <WaveformRecorder
          projectId={projectId}
          onComplete={onUploaded}
          onRequestClose={() => onOpenChange(false)}
        />
      </div>
    </div>
  );
}
