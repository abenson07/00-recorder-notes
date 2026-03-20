"use client";

import { useState } from "react";
import { TabBar } from "@/components/common/TabBar";
import { SearchableTextPane } from "@/components/text/SearchableTextPane";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "transcript", label: "Transcript" },
];

export function ProjectTabs({
  masterTranscript,
  summary,
}: {
  masterTranscript: string;
  summary: string;
}) {
  const [activeId, setActiveId] = useState("summary");
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <label className="sr-only" htmlFor="project-pane-search">
          Search summary and transcript
        </label>
        <input
          id="project-pane-search"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search in Summary / Transcript…"
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30"
          autoComplete="off"
        />
      </div>
      <TabBar tabs={TABS} activeId={activeId} onChange={setActiveId} />
      <div className="min-h-[280px] flex-1 overflow-auto p-4">
        {activeId === "summary" ? (
          <SearchableTextPane body={summary} searchQuery={searchQuery} />
        ) : null}
        {activeId === "transcript" ? (
          <SearchableTextPane
            body={masterTranscript}
            searchQuery={searchQuery}
            emptyMessage="— No master transcript yet —"
          />
        ) : null}
      </div>
    </div>
  );
}
