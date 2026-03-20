import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { openaiChatComplete } from "@/lib/openai/chatComplete";
import { createEmbeddingVectors } from "@/lib/openai/embeddings";
import { OpenAITranscriptionError } from "@/lib/openai/transcribe";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import {
  retrieveProjectChunks,
  type RetrievedChunk,
} from "@/lib/transcripts/retrieve";

const projectIdSchema = z.uuid();

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
});

const TRANSCRIPT_FALLBACK_LEN = 4000;
const RETRIEVAL_TOP_K = 8;

export type ChatSourcePayload = {
  chunkId: string;
  preview: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId: rawId } = await context.params;
  const idParse = projectIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 404 });
  }
  const projectId = idParse.data;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const message = parsed.data.message.trim();

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();
    const { data: project, error } = await supabase
      .from("projects")
      .select("master_transcript, summary")
      .eq("id", projectId)
      .maybeSingle();

    if (error) {
      console.error("[POST /chat] load", error);
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const transcript = (project.master_transcript ?? "").trim();
    const summary = (project.summary ?? "").trim();

    if (!transcript && !summary) {
      return NextResponse.json({
        reply:
          "There’s no master transcript or summary on this project yet. Record something first, then ask again.",
        sources: [],
        grounded: false,
        usedTranscriptFallback: false,
      });
    }

    let retrieved: RetrievedChunk[] = [];
    let retrievalError = false;

    try {
      const [queryEmbedding] = await createEmbeddingVectors({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        inputs: [message],
      });
      retrieved = await retrieveProjectChunks(
        supabase,
        projectId,
        queryEmbedding,
        RETRIEVAL_TOP_K,
      );
    } catch (e) {
      retrievalError = true;
      console.error("[POST /chat] retrieval", e);
    }

    const contextBlocks: string[] = [];
    const sources: ChatSourcePayload[] = [];

    if (retrieved.length > 0) {
      retrieved.forEach((c, i) => {
        contextBlocks.push(`[Excerpt ${i + 1}]\n${c.text}`);
        sources.push({
          chunkId: c.chunkId,
          preview:
            c.text.length > 220 ? `${c.text.slice(0, 220).trim()}…` : c.text,
          metadata: c.metadata,
          similarity: c.similarity,
        });
      });
    } else {
      const fallback =
        transcript.length > 0
          ? transcript.slice(0, TRANSCRIPT_FALLBACK_LEN)
          : summary.slice(0, TRANSCRIPT_FALLBACK_LEN);
      const label =
        transcript.length > 0 ? "Master transcript (truncated)" : "Project summary (truncated)";
      contextBlocks.push(`[${label}]\n${fallback}`);
      if (transcript.length > TRANSCRIPT_FALLBACK_LEN) {
        contextBlocks.push("…(transcript truncated in fallback mode)");
      }
    }

    const contextNote =
      retrieved.length > 0
        ? "Use the numbered excerpts as your primary evidence. Prefer quoting or paraphrasing them."
        : retrievalError
          ? "Vector retrieval was unavailable; rely on the pasted transcript/summary excerpt."
          : "No close semantic matches were found; rely on the pasted transcript/summary excerpt.";

    const systemContent = [
      "You answer questions about the user’s voice-note project.",
      "Be concise and practical. If the context does not contain the answer, say so clearly.",
      contextNote,
      "",
      "Context:",
      contextBlocks.join("\n\n---\n\n"),
    ].join("\n");

    let reply: string;
    try {
      reply = await openaiChatComplete({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: message },
        ],
      });
    } catch (e) {
      if (e instanceof OpenAITranscriptionError) {
        const status =
          e.status === 401 || e.status === 429 ? e.status : 502;
        return NextResponse.json(
          {
            error:
              status === 429
                ? "The assistant is temporarily rate-limited. Try again in a moment."
                : status === 401
                  ? "OpenAI authentication failed on the server."
                  : "The assistant could not generate a reply. Try again shortly.",
            code: e.code,
          },
          { status },
        );
      }
      throw e;
    }

    if (!reply) {
      return NextResponse.json({
        reply: "I couldn’t produce an answer from the available context.",
        sources,
        grounded: retrieved.length > 0,
        usedTranscriptFallback: retrieved.length === 0,
      });
    }

    return NextResponse.json({
      reply,
      sources,
      grounded: retrieved.length > 0,
      usedTranscriptFallback: retrieved.length === 0,
    });
  } catch (e) {
    console.error("[POST /chat]", e);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
