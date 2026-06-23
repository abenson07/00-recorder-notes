import { createEmbeddingVectors } from "@/lib/openai/embeddings";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkTranscriptText } from "@/lib/transcripts/chunkText";

/**
 * Replaces prior `recording_transcript` chunks for this recording, then inserts
 * new rows + embeddings (OpenAI text-embedding-3-small, 1536-dim).
 */
export async function ingestRecordingTranscriptChunks({
  supabase,
  itemId,
  recordingId,
  transcriptText,
  openaiApiKey,
  openaiBaseUrl,
}: {
  supabase: SupabaseClient;
  itemId: string;
  recordingId: string;
  transcriptText: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
}): Promise<{ chunkCount: number }> {
  const parts = chunkTranscriptText(transcriptText);
  if (parts.length === 0) {
    return { chunkCount: 0 };
  }

  const { error: delErr } = await supabase
    .from("transcript_chunks")
    .delete()
    .eq("recording_id", recordingId)
    .eq("source_type", "recording_transcript");

  if (delErr) {
    throw new Error(delErr.message || "Failed to clear old chunks");
  }

  const vectors = await createEmbeddingVectors({
    apiKey: openaiApiKey,
    baseUrl: openaiBaseUrl,
    inputs: parts,
  });

  if (vectors.length !== parts.length) {
    throw new Error("Embedding count mismatch");
  }

  for (let i = 0; i < parts.length; i += 1) {
    const { data: chunkRow, error: insChunkErr } = await supabase
      .from("transcript_chunks")
      .insert({
        item_id: itemId,
        recording_id: recordingId,
        source_type: "recording_transcript",
        chunk_text: parts[i],
        metadata: {
          chunk_index: i,
          recording_id: recordingId,
        },
      })
      .select("id")
      .single();

    if (insChunkErr || !chunkRow?.id) {
      throw new Error(insChunkErr?.message || "Failed to insert chunk");
    }

    const { error: insEmbErr } = await supabase.from("transcript_embeddings").insert({
      chunk_id: chunkRow.id,
      embedding: vectors[i],
    });

    if (insEmbErr) {
      throw new Error(insEmbErr.message || "Failed to insert embedding");
    }
  }

  return { chunkCount: parts.length };
}
