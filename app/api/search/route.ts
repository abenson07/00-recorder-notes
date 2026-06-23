import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import { createEmbeddingVectors } from "@/lib/openai/embeddings";
import { createServiceRoleClient } from "@/lib/supabase/serverAdmin";
import { retrieveGlobalChunks, type RetrievedChunk } from "@/lib/transcripts/retrieve";

const bodySchema = z.object({
  query: z.string().min(1).max(4000),
  topK: z.number().int().min(1).max(25).optional(),
});

function readSearchMinSimilarity(): number {
  const raw = process.env.SEARCH_MIN_SIMILARITY?.trim();
  if (!raw) {
    return 0.38;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 0.38;
  }
  return Math.min(1, Math.max(0, n));
}

function literalIlikeNeedle(query: string): string | null {
  const t = query
    .trim()
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
  if (t.length < 2) {
    return null;
  }
  return t;
}

const LITERAL_MATCH_SCORE = 0.96;

export async function POST(request: Request) {
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
  const topK = parsed.data.topK ?? 12;

  try {
    const env = getServerEnv();
    const supabase = createServiceRoleClient();

    const [queryEmbedding] = await createEmbeddingVectors({
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL,
      inputs: [query],
    });

    const vectorTopK = Math.min(50, Math.max(topK, 24));
    const vectorChunks = await retrieveGlobalChunks(supabase, queryEmbedding, vectorTopK);

    const needle = literalIlikeNeedle(query);
    let literalRows: {
      id: string;
      item_id: string;
      recording_id: string | null;
      chunk_text: string;
      metadata: unknown;
    }[] = [];

    if (needle) {
      const pattern = `%${needle}%`;
      const { data: lit, error: litErr } = await supabase
        .from("transcript_chunks")
        .select("id, item_id, recording_id, chunk_text, metadata")
        .ilike("chunk_text", pattern)
        .limit(40);

      if (litErr) {
        console.error("[POST /api/search] literal chunk search", litErr);
      } else if (Array.isArray(lit)) {
        literalRows = lit as typeof literalRows;
      }
    }

    const literalIdSet = new Set(literalRows.map((r) => r.id));
    const byChunkId = new Map<string, RetrievedChunk>();

    for (const c of vectorChunks) {
      byChunkId.set(c.chunkId, { ...c });
    }

    for (const row of literalRows) {
      const meta =
        row.metadata !== null &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null;
      const existing = byChunkId.get(row.id);
      const literalChunk: RetrievedChunk = {
        chunkId: row.id,
        text: row.chunk_text,
        metadata: meta,
        similarity: LITERAL_MATCH_SCORE,
        itemId: row.item_id,
        projectId: row.item_id,
        recordingId: row.recording_id,
      };
      if (!existing) {
        byChunkId.set(row.id, literalChunk);
      } else {
        byChunkId.set(row.id, {
          ...existing,
          similarity: Math.max(existing.similarity, LITERAL_MATCH_SCORE),
        });
      }
    }

    const merged = [...byChunkId.values()];
    const minSimilarity = readSearchMinSimilarity();
    const passing = merged.filter(
      (c) =>
        c.itemId &&
        (c.similarity >= minSimilarity || literalIdSet.has(c.chunkId)),
    );

    const vectorOnlyPassing = vectorChunks.filter(
      (c) => c.itemId && c.similarity >= minSimilarity,
    );
    const allBelowThreshold =
      vectorChunks.length > 0 &&
      vectorOnlyPassing.length === 0 &&
      passing.length === 0;

    passing.sort((a, b) => {
      const la = literalIdSet.has(a.chunkId) ? 1 : 0;
      const lb = literalIdSet.has(b.chunkId) ? 1 : 0;
      if (la !== lb) {
        return lb - la;
      }
      return b.similarity - a.similarity;
    });

    const maxOut = Math.min(50, Math.max(topK, 20));
    const ranked = passing.slice(0, maxOut);

    const itemIds = [...new Set(ranked.map((c) => c.itemId).filter(Boolean))] as string[];
    const recordingIds = [
      ...new Set(ranked.map((c) => c.recordingId).filter((id): id is string => Boolean(id))),
    ];

    const itemTitleById = new Map<string, string>();
    const itemProjectIdById = new Map<string, string | null>();
    if (itemIds.length > 0) {
      const { data: items, error: itemErr } = await supabase
        .from("items")
        .select("id, title, project_id")
        .in("id", itemIds);

      if (itemErr) {
        console.error("[POST /api/search] load items", itemErr);
        return NextResponse.json({ error: "Failed to load item titles" }, { status: 500 });
      }
      for (const item of items ?? []) {
        if (item?.id) {
          const title = typeof item.title === "string" ? item.title.trim() : "";
          itemTitleById.set(item.id, title || "Untitled item");
          itemProjectIdById.set(item.id, item.project_id ?? null);
        }
      }
    }

    const parentProjectTitleById = new Map<string, string>();
    const parentProjectIds = [
      ...new Set(
        [...itemProjectIdById.values()].filter((id): id is string => Boolean(id)),
      ),
    ];
    if (parentProjectIds.length > 0) {
      const { data: projects } = await supabase
        .from("projects")
        .select("id, title")
        .in("id", parentProjectIds);
      for (const p of projects ?? []) {
        if (p?.id) {
          parentProjectTitleById.set(
            p.id,
            typeof p.title === "string" && p.title.trim() ? p.title : "Untitled project",
          );
        }
      }
    }

    const recordingCreatedAtById = new Map<string, string>();
    if (recordingIds.length > 0) {
      const { data: recs, error: recErr } = await supabase
        .from("note_recordings")
        .select("id, created_at")
        .in("id", recordingIds);

      if (recErr) {
        console.error("[POST /api/search] load recordings", recErr);
        return NextResponse.json({ error: "Failed to load recording metadata" }, { status: 500 });
      }
      for (const r of recs ?? []) {
        if (r?.id && r.created_at) {
          recordingCreatedAtById.set(r.id, r.created_at);
        }
      }
    }

    const results = ranked.map((c) => {
      const iid = c.itemId as string;
      const rid = c.recordingId ?? undefined;
      const parentProjectId = itemProjectIdById.get(iid) ?? null;
      return {
        itemId: iid,
        itemTitle: itemTitleById.get(iid) ?? "Untitled item",
        /** @deprecated Use itemId */
        projectId: iid,
        /** @deprecated Use itemTitle */
        projectTitle: itemTitleById.get(iid) ?? "Untitled item",
        parentProjectId,
        parentProjectTitle: parentProjectId
          ? parentProjectTitleById.get(parentProjectId) ?? null
          : null,
        recordingId: rid,
        recordingCreatedAt: rid ? recordingCreatedAtById.get(rid) ?? null : null,
        chunkText: c.text,
        score: c.similarity,
        metadata: c.metadata,
      };
    });

    return NextResponse.json({
      results,
      ...(allBelowThreshold ? { allBelowSimilarityThreshold: true as const } : {}),
    });
  } catch (e) {
    console.error("[POST /api/search]", e);
    return NextResponse.json(
      { error: "Search failed. Check embedding API and database migration." },
      { status: 502 },
    );
  }
}
