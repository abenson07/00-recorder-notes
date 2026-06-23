import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createEmbeddingVectors } from "@/lib/openai/embeddings";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { retrieveItemChunks } from "@/lib/transcripts/retrieve";

const itemIdSchema = z.uuid();

const bodySchema = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(25).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId: rawId } = await context.params;
  const idParse = itemIdSchema.safeParse(rawId);
  if (!idParse.success) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 404 });
  }
  const itemId = idParse.data;

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

    const { data: item, error: itemErr } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .maybeSingle();

    if (itemErr) {
      console.error("[POST /retrieve] load item", itemErr);
      return NextResponse.json({ error: "Failed to load item" }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const [queryEmbedding] = await createEmbeddingVectors({
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      inputs: [query],
    });

    const chunks = await retrieveItemChunks(supabase, itemId, queryEmbedding, topK);

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
