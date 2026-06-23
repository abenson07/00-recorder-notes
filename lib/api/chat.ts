export type ChatSource = {
  chunkId: string;
  preview: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export async function postItemChat(
  itemId: string,
  message: string,
): Promise<{
  reply: string;
  sources: ChatSource[];
  grounded: boolean;
  usedTranscriptFallback: boolean;
}> {
  const res = await fetch(
    `/api/items/${encodeURIComponent(itemId)}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    reply?: string;
    sources?: ChatSource[];
    grounded?: boolean;
    usedTranscriptFallback?: boolean;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Chat request failed",
    );
  }
  return {
    reply: typeof data.reply === "string" ? data.reply : "",
    sources: Array.isArray(data.sources) ? data.sources : [],
    grounded: Boolean(data.grounded),
    usedTranscriptFallback: Boolean(data.usedTranscriptFallback),
  };
}

/** @deprecated Use postItemChat */
export const postProjectChat = postItemChat;
