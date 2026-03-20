import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";

const projectIdSchema = z.uuid();

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
});

const TRANSCRIPT_SNIP_LEN = 4000;

/**
 * v1: transcript-only context (no vector store). Full grounding in note-005.
 */
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
      });
    }

    const contextBlock =
      transcript.length > 0
        ? transcript.slice(0, TRANSCRIPT_SNIP_LEN)
        : summary.slice(0, TRANSCRIPT_SNIP_LEN);

    const reply = [
      "[Transcript-only v1 — vector search comes in a later update]",
      "",
      `Your message: “${message}”`,
      "",
      "Context from this project (master transcript, truncated if long):",
      "---",
      contextBlock,
      transcript.length > TRANSCRIPT_SNIP_LEN ? "\n…(truncated)" : "",
      "---",
    ]
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("[POST /chat]", e);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
