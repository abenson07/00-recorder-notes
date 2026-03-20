#!/usr/bin/env node
/**
 * Automates acceptance block **C** for note-005: POST /api/projects/:projectId/retrieve
 *
 * - Resolves app URL like smoke-note-001 (BASE_URL or scan 3000–3020).
 * - Picks a project with transcript text (SMOKE_PROJECT_ID to pin, else first suitable).
 * - Runs two retrieval queries (verbatim phrase + alternate phrase from same transcript).
 * - Asserts HTTP 200, chunks array, and that top chunks contain the expected wording.
 * - Checks 404 for a random project UUID.
 *
 * Requires: `npm run dev` (Next loads .env.local). No curl/Postman needed.
 *
 *   npm run smoke:note-005-retrieve
 *   SMOKE_PROJECT_ID=<uuid> npm run smoke:note-005-retrieve
 *   BASE_URL=http://localhost:3010 npm run smoke:note-005-retrieve
 */

const PORT_SCAN_START = 3000;
const PORT_SCAN_END = 3020;

function looksLikeNoteHealth(body) {
  return (
    body &&
    typeof body === "object" &&
    typeof body.ok === "boolean" &&
    typeof body.supabase === "string"
  );
}

async function resolveBaseUrl() {
  const explicit = process.env.BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  for (let port = PORT_SCAN_START; port <= PORT_SCAN_END; port++) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(1200),
      });
      const text = await res.text();
      let body;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        continue;
      }
      if (!looksLikeNoteHealth(body)) continue;
      return base;
    } catch {
      continue;
    }
  }

  fail(
    "Find dev server",
    `No note-recording-app /api/health on 127.0.0.1:${PORT_SCAN_START}–${PORT_SCAN_END}. Run \`npm run dev\` from this repo, or set BASE_URL.`,
  );
}

function fail(step, details) {
  console.error(`\n✖ ${step}`);
  if (details != null) console.error(details);
  process.exit(1);
}

async function json(res, step) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    fail(step, `Not JSON (${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    fail(step, `${res.status} ${res.statusText}\n${JSON.stringify(body, null, 2)}`);
  }
  return body;
}

/** Master transcript wraps each take with `[Recording <uuid>]`; chunks store raw text only. */
function stripRecordingMarkers(text) {
  return text.replace(/\n?\[Recording [a-f0-9-]+\]\s*/gi, "\n");
}

/** ~4–8 words from text for a stable search phrase */
function pickPhrase(text, offsetChars = 0) {
  const t = text
    .slice(offsetChars)
    .trim()
    .replace(/\s+/g, " ");
  if (t.length < 24) return null;
  const words = t.split(" ");
  const n = Math.min(8, Math.max(4, words.length >= 8 ? 6 : words.length));
  const phrase = words.slice(0, n).join(" ").trim();
  return phrase.length >= 12 ? phrase : null;
}

function chunkContainsPhrase(chunkText, phrase) {
  if (!phrase || !chunkText) return false;
  const a = chunkText.toLowerCase();
  const b = phrase.toLowerCase();
  return a.includes(b);
}

async function postRetrieve(base, projectId, query, topK = 8) {
  const res = await fetch(`${base}/api/projects/${projectId}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, topK }),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    return { ok: false, status: res.status, parseError: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const base = await resolveBaseUrl();
  const usedScan = !process.env.BASE_URL?.trim();
  console.log(
    `note-005 retrieve smoke → ${base}${usedScan ? " (auto-detected; set BASE_URL to pin)\n" : "\n"}`,
  );

  await json(await fetch(`${base}/api/health`), "Health check");
  console.log("✓ Health");

  const pinned = process.env.SMOKE_PROJECT_ID?.trim();
  let projectId = pinned;

  if (!projectId) {
    const list = await json(await fetch(`${base}/api/projects`), "List projects");
    if (!Array.isArray(list) || list.length === 0) {
      fail("Pick project", "No projects. Create one and transcribe a recording first.");
    }
    const withRec = list.find((p) => (p.recordingsCount ?? 0) > 0);
    const candidate = withRec ?? list[0];
    projectId = candidate.id;
    console.log(`  (using project ${projectId} — set SMOKE_PROJECT_ID to pin)`);
  }

  const project = await json(
    await fetch(`${base}/api/projects/${projectId}`),
    "GET project",
  );
  const master = typeof project.master_transcript === "string" ? project.master_transcript : "";
  const summary = typeof project.summary === "string" ? project.summary : "";
  const corpus = stripRecordingMarkers(master).trim() || summary.trim();
  if (corpus.length < 40) {
    fail(
      "Transcript content",
      "Project has almost no master_transcript/summary. Transcribe a recording first so retrieval has indexed chunks.",
    );
  }

  const phraseA = pickPhrase(corpus, 0);
  if (!phraseA) {
    fail("Pick phrase A", "Could not derive a phrase from transcript.");
  }

  const mid = Math.min(Math.floor(corpus.length / 3), corpus.length - 80);
  let phraseB = pickPhrase(corpus, mid) ?? phraseA;
  if (phraseB.toLowerCase() === phraseA.toLowerCase()) {
    const sentences = corpus.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 30);
    const alt = sentences[1] ? pickPhrase(sentences[1], 0) : null;
    if (alt && alt.toLowerCase() !== phraseA.toLowerCase()) {
      phraseB = alt;
    }
  }

  console.log(`\nQuery A (verbatim-style): "${phraseA.slice(0, 72)}${phraseA.length > 72 ? "…" : ""}"`);
  const rA = await postRetrieve(base, projectId, phraseA, 8);
  if (!rA.ok || !rA.body) {
    fail(
      "POST retrieve (query A)",
      rA.parseError ?? JSON.stringify(rA, null, 2),
    );
  }
  if (rA.status !== 200) {
    fail("POST retrieve (query A)", rA.body);
  }
  const chunksA = rA.body.chunks;
  if (!Array.isArray(chunksA)) {
    fail("Response shape (query A)", "Expected { chunks: array }");
  }
  if (chunksA.length === 0) {
    fail(
      "Retrieve results (query A)",
      "No chunks returned. Confirm note-005 migration is applied and a recording was transcribed after ingest was deployed.",
    );
  }
  const hitA = chunksA.some((c) => chunkContainsPhrase(c.text, phraseA));
  if (!hitA) {
    fail(
      "Relevance (query A)",
      `Expected at least one chunk containing phrase (case-insensitive): ${JSON.stringify(phraseA)}\nGot ${chunksA.length} chunks; first text preview: ${JSON.stringify((chunksA[0]?.text ?? "").slice(0, 160))}`,
    );
  }
  console.log(`✓ Query A: ${chunksA.length} chunk(s); top similarity ${(chunksA[0]?.similarity ?? 0).toFixed(4)}`);

  console.log(`\nQuery B (alternate excerpt): "${phraseB.slice(0, 72)}${phraseB.length > 72 ? "…" : ""}"`);
  const rB = await postRetrieve(base, projectId, phraseB, 8);
  if (!rB.ok || rB.status !== 200 || !rB.body?.chunks) {
    fail("POST retrieve (query B)", rB.body ?? rB);
  }
  const chunksB = rB.body.chunks;
  if (chunksB.length === 0) {
    fail("Retrieve results (query B)", "Expected at least one chunk for alternate query.");
  }
  const hitB = chunksB.some((c) => chunkContainsPhrase(c.text, phraseB));
  if (!hitB) {
    fail(
      "Relevance (query B)",
      `Expected a chunk containing: ${JSON.stringify(phraseB)}`,
    );
  }
  console.log(`✓ Query B: ${chunksB.length} chunk(s); relevance OK`);

  const fakeId = "00000000-0000-4000-8000-000000000001";
  const r404 = await postRetrieve(base, fakeId, "test query", 3);
  if (r404.status !== 404) {
    fail("Invalid project id", `Expected 404 for bogus UUID; got ${r404.status}`);
  }
  console.log("✓ Bogus projectId returns 404");

  console.log("\nAll retrieve checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
