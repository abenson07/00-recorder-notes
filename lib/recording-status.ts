import type { RecordingStatus } from "@/lib/types";

/** User-facing label for list/detail (maps DB statuses to pending / transcribed / failed). */
export function recordingStatusLabel(status: RecordingStatus): string {
  switch (status) {
    case "transcribed":
      return "Transcribed";
    case "failed":
      return "Failed";
    default:
      return "Pending";
  }
}

export function recordingStatusBadgeClass(status: RecordingStatus): string {
  switch (status) {
    case "transcribed":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "failed":
      return "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200";
    default:
      return "bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100";
  }
}
