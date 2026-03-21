"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchGlobalSearch, type GlobalSearchResult } from "@/lib/api/search";
import { cn } from "@/lib/cn";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightSnippet({ text, query }: { text: string; query: string }) {
  const pattern = useMemo(() => {
    const terms = [
      ...new Set(
        query
          .trim()
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 2),
      ),
    ];
    if (terms.length === 0) return null;
    return new RegExp(`(${terms.map((t) => escapeRegExp(t)).join("|")})`, "gi");
  }, [query]);

  if (!pattern) {
    return <>{text}</>;
  }

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  const s = text;
  let m: RegExpExecArray | null;
  const re = new RegExp(pattern.source, pattern.flags);
  while ((m = re.exec(s)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(s.slice(lastIndex, m.index));
    }
    nodes.push(
      <mark
        key={`${m.index}-${m[0]}`}
        className="rounded bg-amber-200/90 px-0.5 text-inherit dark:bg-amber-900/50"
      >
        {m[0]}
      </mark>,
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < s.length) {
    nodes.push(s.slice(lastIndex));
  }
  return <>{nodes}</>;
}

function groupByProject(results: GlobalSearchResult[]) {
  const order: string[] = [];
  const map = new Map<string, { projectTitle: string; items: GlobalSearchResult[] }>();
  for (const r of results) {
    if (!map.has(r.projectId)) {
      order.push(r.projectId);
      map.set(r.projectId, { projectTitle: r.projectTitle, items: [] });
    }
    map.get(r.projectId)!.items.push(r);
  }
  return order.map((id) => {
    const g = map.get(id)!;
    return { projectId: id, projectTitle: g.projectTitle, items: g.items };
  });
}

function formatRecordingTime(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return null;
  }
}

export function GlobalSearchSection({
  className,
  onSearchActiveChange,
  appBasePath = "",
}: {
  className?: string;
  onSearchActiveChange?: (active: boolean) => void;
  appBasePath?: string;
}) {
  const base = appBasePath.replace(/\/$/, "");
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 320);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    onSearchActiveChange?.(debounced.length > 0);
  }, [debounced, onSearchActiveChange]);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => fetchGlobalSearch(debounced, 16),
    enabled: debounced.length > 0,
  });

  const grouped = useMemo(
    () => (data?.results?.length ? groupByProject(data.results) : []),
    [data],
  );
  const activeSearch = debounced.length > 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <label className="sr-only" htmlFor="global-search">
          Search transcripts
        </label>
        <input
          id="global-search"
          type="search"
          name="q"
          autoComplete="off"
          placeholder="Search across all projects…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
        />
        {activeSearch ? (
          <button
            type="button"
            onClick={() => {
              setInput("");
              setDebounced("");
            }}
            className="shrink-0 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Clear
          </button>
        ) : null}
      </div>

      {activeSearch ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          {isFetching ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
          ) : isError ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-700 dark:text-red-300" role="alert">
                {error instanceof Error ? error.message : "Search failed"}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="self-start text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
              >
                Retry
              </button>
            </div>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {data?.allBelowSimilarityThreshold
                ? "Nothing matched closely enough to show. Try different wording, or lower SEARCH_MIN_SIMILARITY in .env.local if results are too strict."
                : "No matches"}
            </p>
          ) : (
            <ul className="flex flex-col gap-6">
              {grouped.map((g) => (
                <li key={g.projectId}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {g.projectTitle}
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {g.items.map((r, idx) => {
                      const href =
                        r.recordingId != null && r.recordingId !== ""
                          ? `${base}/projects/${r.projectId}/recordings/${r.recordingId}`
                          : `${base}/projects/${r.projectId}`;
                      const when = formatRecordingTime(r.recordingCreatedAt);
                      return (
                        <li key={`${r.projectId}-${r.recordingId ?? "p"}-${idx}-${r.score}`}>
                          <Link
                            href={href}
                            className="block rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-950"
                          >
                            {when ? (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">{when}</p>
                            ) : r.recordingId ? (
                              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                Recording
                              </p>
                            ) : (
                              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                Project transcript
                              </p>
                            )}
                            <p className="mt-1 line-clamp-4 text-sm text-zinc-800 dark:text-zinc-200">
                              <HighlightSnippet text={r.chunkText} query={debounced} />
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
