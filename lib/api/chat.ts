export async function postProjectChat(
  projectId: string,
  message: string,
): Promise<{ reply: string }> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    reply?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Chat request failed",
    );
  }
  return {
    reply: typeof data.reply === "string" ? data.reply : "",
  };
}
