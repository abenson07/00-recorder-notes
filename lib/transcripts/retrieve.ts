import type { SupabaseClient } from "@supabase/supabase-js";

export type RetrievedChunk = {
  chunkId: string;
  text: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
  itemId?: string;
  /** @deprecated Use itemId */
  projectId?: string;
  recordingId?: string | null;
};

type MatchRow = {
  chunk_id: string;
  chunk_text: string;
  metadata: unknown;
  similarity: number;
  item_id?: string;
  project_id?: string;
  recording_id?: string | null;
};

function rowToChunk(row: MatchRow): RetrievedChunk {
  const itemId = row.item_id ?? row.project_id;
  return {
    chunkId: row.chunk_id,
    text: row.chunk_text,
    metadata:
      row.metadata !== null &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    similarity: row.similarity,
    itemId,
    projectId: itemId,
    recordingId: row.recording_id ?? null,
  };
}

/** Embed query with caller's embedding; runs pgvector RPC scoped to an item. */
export async function retrieveItemChunks(
  supabase: SupabaseClient,
  itemId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_item_chunks", {
    query_embedding: queryEmbedding,
    match_item_id: itemId,
    match_count: topK,
  });

  if (error) {
    console.error("[retrieveItemChunks]", error);
    throw new Error(error.message || "Retrieval failed");
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as MatchRow[]).map(rowToChunk);
}

/** @deprecated Use retrieveItemChunks */
export async function retrieveProjectChunks(
  supabase: SupabaseClient,
  projectId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<RetrievedChunk[]> {
  return retrieveItemChunks(supabase, projectId, queryEmbedding, topK);
}

export async function retrieveGlobalChunks(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  topK: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_global_chunks", {
    query_embedding: queryEmbedding,
    match_count: topK,
  });

  if (error) {
    console.error("[retrieveGlobalChunks]", error);
    throw new Error(error.message || "Retrieval failed");
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as MatchRow[]).map(rowToChunk);
}
