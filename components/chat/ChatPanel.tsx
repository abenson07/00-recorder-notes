"use client";

import { useState } from "react";
import { postProjectChat } from "@/lib/api/chat";

type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

export function ChatPanel({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const { reply } = await postProjectChat(projectId, text);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: reply.trim() || "(Empty reply)",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[min(70vh,520px)] flex-col gap-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Answers use the project master transcript only (no vector search yet).
      </p>

      <ul
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/50"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <li className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask a question about this project’s transcript.
          </li>
        ) : null}
        {messages.map((msg) => (
          <li
            key={msg.id}
            className={
              msg.role === "user"
                ? "ml-4 rounded-lg bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "mr-4 rounded-lg bg-zinc-200/60 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-200"
            }
          >
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {msg.role === "user" ? "You" : "Assistant"}
            </span>
            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="sr-only" htmlFor={`chat-input-${projectId}`}>
          Message
        </label>
        <textarea
          id={`chat-input-${projectId}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          rows={3}
          placeholder="Message…"
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/30 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500/30"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="self-end rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}
