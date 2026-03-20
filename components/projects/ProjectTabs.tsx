"use client";

import { useState } from "react";
import { TabBar } from "@/components/common/TabBar";
import { SearchableTextPane } from "@/components/text/SearchableTextPane";
import { ChatPanel } from "@/components/chat/ChatPanel";

const TABS = [
  { id: "transcript", label: "Transcript" },
  { id: "summary", label: "Summary" },
  { id: "chat", label: "Chat" },
];

export function ProjectTabs({
  projectId,
  masterTranscript,
  summary,
}: {
  projectId: string;
  masterTranscript: string;
  summary: string;
}) {
  const [activeId, setActiveId] = useState("transcript");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <TabBar tabs={TABS} activeId={activeId} onChange={setActiveId} />
      <div className="min-h-[280px] flex-1 overflow-auto p-4">
        {activeId === "transcript" ? (
          <SearchableTextPane title="Master transcript" body={masterTranscript} />
        ) : null}
        {activeId === "summary" ? (
          <SearchableTextPane title="Summary" body={summary} />
        ) : null}
        {activeId === "chat" ? <ChatPanel projectId={projectId} /> : null}
      </div>
    </div>
  );
}
