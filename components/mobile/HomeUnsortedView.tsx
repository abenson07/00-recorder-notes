"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/common/EmptyState";
import { RecordButton } from "@/components/record/RecordButton";
import { RecordModal } from "@/components/record/RecordModal";
import { createPlaceholderItem, fetchItems } from "@/lib/api/items";

export function HomeUnsortedView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordItemId, setRecordItemId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items", "unsorted"],
    queryFn: () => fetchItems({ unsorted: true }),
  });

  const beginRecording = async () => {
    setCreating(true);
    try {
      const id = await createPlaceholderItem();
      setRecordItemId(id);
      setRecordOpen(true);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-stone-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 md:hidden">
      <header>
        <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-50">Home</h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Unsorted recordings and recent items
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="No recordings yet"
          description="Record or upload audio to get started."
          action={
            <RecordButton
              onClick={() => void beginRecording()}
              disabled={creating}
            />
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/items/${item.id}`}
                className="block rounded-2xl border border-stone-200/80 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-900/80"
              >
                <h2 className="font-medium text-stone-900 dark:text-stone-50">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs text-stone-500">
                  {item.recordings_count} file{item.recordings_count === 1 ? "" : "s"}
                  {item.master_transcript_preview ? " · has transcript" : ""}
                </p>
                {item.master_transcript_preview ? (
                  <p className="mt-2 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">
                    {item.master_transcript_preview}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        <div className="fixed bottom-24 left-0 right-0 flex justify-center">
          <RecordButton
            variant="fab"
            label="Record"
            onClick={() => void beginRecording()}
            disabled={creating}
          />
        </div>
      ) : null}

      <RecordModal
        open={recordOpen}
        itemId={recordItemId}
        onOpenChange={(next) => {
          setRecordOpen(next);
          if (!next) setRecordItemId(null);
        }}
        onUploaded={async (recordingId) => {
          const iid = recordItemId;
          setRecordOpen(false);
          setRecordItemId(null);
          await queryClient.invalidateQueries({ queryKey: ["items"] });
          if (iid) {
            router.push(`/items/${iid}/recordings/${recordingId}`);
          }
        }}
      />
    </div>
  );
}
