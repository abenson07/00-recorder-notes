"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
}

export function TabBar({
  tabs,
  activeId,
  onChange,
}: {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex gap-1 border-b border-zinc-200 bg-zinc-50/80 px-2 dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "relative -mb-px px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-zinc-900 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-zinc-900 dark:text-white dark:after:bg-white"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
