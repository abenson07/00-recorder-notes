import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createEmbeddingVectors } from "@/lib/openai/embeddings";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { retrieveProjectChunks } from "@/lib/transcripts/retrieve";

const projectIdSchema = z.uuid();

const bodySchema = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(25).optional(),
});

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

  const query = parsed.data.query.trim();
  const topK = parsed.data.topK ?? 8;

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (projErr) {
      console.error("[POST /retrieve] load project", projErr);
      return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
    }
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [queryEmbedding] = await createEmbeddingVectors({
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      inputs: [query],
    });

    const chunks = await retrieveProjectChunks(supabase, projectId, queryEmbedding, topK);

    return NextResponse.json({
      chunks: chunks.map((c) => ({
        text: c.text,
        metadata: c.metadata,
        similarity: c.similarity,
        chunkId: c.chunkId,
      })),
    });
  } catch (e) {
    console.error("[POST /retrieve]", e);
    return NextResponse.json(
      { error: "Retrieval failed. Check embedding API and database migration." },
      { status: 502 },
    );
  }
}
