import type { SupabaseClient } from "@supabase/supabase-js";

export type RetrievedChunk = {
  chunkId: string;
  text: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
  projectId?: string;
};

type MatchRow = {
  chunk_id: string;
  chunk_text: string;
  metadata: unknown;
  similarity: number;
  project_id?: string;
};

function rowToChunk(row: MatchRow): RetrievedChunk {
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
    projectId: row.project_id,
  };
}

/** Embed query with caller’s embedding; runs pgvector RPC. */
export async function retrieveProjectChunks(
  supabase: SupabaseClient,
  projectId: string,
  queryEmbedding: number[],
  topK: number,
): Promise<RetrievedChunk[]> {
  const { data, error } = await supabase.rpc("match_project_chunks", {
    query_embedding: queryEmbedding,
    match_project_id: projectId,
    match_count: topK,
  });

  if (error) {
    console.error("[retrieveProjectChunks]", error);
    throw new Error(error.message || "Retrieval failed");
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return (data as MatchRow[]).map(rowToChunk);
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
