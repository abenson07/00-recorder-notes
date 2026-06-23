import { redirect } from "next/navigation";

/** Backward compat: old recording URLs under /projects/ → /items/ */
export default async function LegacyRecordingRedirect({
  params,
}: {
  params: Promise<{ projectId: string; recordingId: string }>;
}) {
  const { projectId, recordingId } = await params;
  redirect(`/items/${projectId}/recordings/${recordingId}`);
}
