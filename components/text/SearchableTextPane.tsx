"use client";

import { useMemo } from "react";

type Part = { key: string; mark: boolean; text: string };

function splitHighlight(text: string, query: string): Part[] {
  const q = query.trim();
  if (!q) {
    return text ? [{ key: "a0", mark: false, text }] : [];
  }
  const lower = text.toLowerCase();
  const lq = q.toLowerCase();
  const parts: Part[] = [];
  let i = 0;
  let seq = 0;
  while (i < text.length) {
    const j = lower.indexOf(lq, i);
    if (j === -1) {
      parts.push({ key: `p${seq++}`, mark: false, text: text.slice(i) });
      break;
    }
    if (j > i) {
      parts.push({ key: `p${seq++}`, mark: false, text: text.slice(i, j) });
    }
    parts.push({
      key: `p${seq++}`,
      mark: true,
      text: text.slice(j, j + lq.length),
    });
    i = j + lq.length;
  }
  return parts;
}

export function SearchableTextPane({
  title,
  body,
  searchQuery = "",
  emptyMessage = "— No content yet —",
}: {
  title?: string;
  body: string;
  searchQuery?: string;
  emptyMessage?: string;
}) {
  const trimmed = body.trim();
  const parts = useMemo(
    () => splitHighlight(trimmed, searchQuery),
    [trimmed, searchQuery],
  );

  return (
    <div className="space-y-2">
      {title ? (
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
      ) : null}
      <div className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {trimmed ? (
          parts.map((p) =>
            p.mark ? (
              <mark
                key={p.key}
                className="rounded-sm bg-amber-200/90 px-0.5 text-zinc-900 dark:bg-amber-500/35 dark:text-zinc-50"
              >
                {p.text}
              </mark>
            ) : (
              <span key={p.key}>{p.text}</span>
            ),
          )
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">{emptyMessage}</span>
        )}
      </div>
    </div>
  );
}
