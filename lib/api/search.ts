export type GlobalSearchResult = {
  itemId: string;
  itemTitle: string;
  parentProjectId: string | null;
  parentProjectTitle: string | null;
  recordingId?: string;
  recordingCreatedAt: string | null;
  chunkText: string;
  score: number;
  metadata: Record<string, unknown> | null;
  /** @deprecated Use itemId */
  projectId: string;
  /** @deprecated Use itemTitle */
  projectTitle: string;
};

export type GlobalSearchResponse = {
  results: GlobalSearchResult[];
  allBelowSimilarityThreshold?: boolean;
};

export async function fetchGlobalSearch(
  query: string,
  topK?: number,
): Promise<GlobalSearchResponse> {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      ...(topK != null ? { topK } : {}),
    }),
  });
  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error?: unknown }).error)
        : "Search failed";
    throw new Error(err);
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("results" in data) ||
    !Array.isArray((data as { results: unknown }).results)
  ) {
    return { results: [] };
  }
  const results = (data as { results: GlobalSearchResult[] }).results;
  const allBelowSimilarityThreshold =
    typeof data === "object" &&
    data !== null &&
    "allBelowSimilarityThreshold" in data &&
    (data as { allBelowSimilarityThreshold?: unknown }).allBelowSimilarityThreshold === true;
  return { results, ...(allBelowSimilarityThreshold ? { allBelowSimilarityThreshold: true } : {}) };
}
