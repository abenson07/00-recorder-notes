"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";
import { cn } from "@/lib/cn";

export function ProjectRecordFab({
  projectId,
  className,
}: {
  projectId: string;
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed bottom-8 left-0 right-0 flex justify-center px-4",
          className,
        )}
      >
        <div className="pointer-events-auto">
          <RecordButton variant="fab" label="Record" onClick={() => setOpen(true)} />
        </div>
      </div>

      <RecordModal
        open={open}
        projectId={projectId}
        onOpenChange={setOpen}
        onUploaded={async (recordingId) => {
          setOpen(false);
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          router.push(`/projects/${projectId}/recordings/${recordingId}`);
          router.refresh();
        }}
      />
    </>
  );
}
