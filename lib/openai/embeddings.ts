import { OpenAITranscriptionError } from "@/lib/openai/transcribe";

const DEFAULT_MODEL = "text-embedding-3-small";

export const EMBEDDING_DIMENSION = 1536;

export async function createEmbeddingVectors({
  apiKey,
  baseUrl,
  inputs,
  model = DEFAULT_MODEL,
}: {
  apiKey: string;
  baseUrl: string;
  inputs: string[];
  model?: string;
}): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }

  const url = `${baseUrl.replace(/\/$/, "")}/embeddings`;
  const out: number[][] = [];
  const batchSize = 16;

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: batch,
        dimensions: EMBEDDING_DIMENSION,
      }),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const detail =
        typeof parsed === "object" &&
        parsed !== null &&
        "error" in parsed &&
        typeof (parsed as { error?: { message?: string } }).error?.message === "string"
          ? (parsed as { error: { message: string } }).error.message
          : text || response.statusText;

      if (response.status === 401) {
        throw new OpenAITranscriptionError(
          "OpenAI authentication failed",
          401,
          "OPENAI_UNAUTHORIZED",
        );
      }
      if (response.status === 429) {
        throw new OpenAITranscriptionError(
          "OpenAI rate limit exceeded",
          429,
          "OPENAI_RATE_LIMIT",
        );
      }
      throw new OpenAITranscriptionError(
        detail.slice(0, 500) || `OpenAI embeddings failed (${response.status})`,
        response.status || 502,
        "OPENAI_EMBEDDING_ERROR",
      );
    }

    const data = (parsed as { data?: { embedding?: number[]; index?: number }[] })?.data;
    if (!Array.isArray(data) || data.length !== batch.length) {
      throw new OpenAITranscriptionError(
        "OpenAI embeddings response shape unexpected",
        502,
        "OPENAI_EMBEDDING_SHAPE",
      );
    }

    const sorted = [...data].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0),
    );
    for (const row of sorted) {
      const emb = row.embedding;
      if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIMENSION) {
        throw new OpenAITranscriptionError(
          "OpenAI embedding dimension mismatch",
          502,
          "OPENAI_EMBEDDING_DIM",
        );
      }
      out.push(emb);
    }
  }

  return out;
}
