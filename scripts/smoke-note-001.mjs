#!/usr/bin/env node
/**
 * Smoke test for note-001 APIs (health, projects CRUD slice, recording + storage).
 *
 * Without BASE_URL, scans 127.0.0.1:3000–3020 for this app’s /api/health so another
 * project on 3000 does not break the test.
 *
 * Pin a server: BASE_URL=http://localhost:3010 npm run smoke:note-001
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
    `No note-recording-app /api/health on 127.0.0.1:${PORT_SCAN_START}–${PORT_SCAN_END}. In this folder run \`npm run dev\` (Next will pick a free port), then run this script again. Or set BASE_URL explicitly.`,
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
    const looksHtml = /^\s*</.test(text) || text.includes("<!DOCTYPE");
    const wrongAppHint =
      step === "Health check" && (res.status === 404 || looksHtml)
        ? "\n\nHint: Got HTML instead of JSON — that URL is not note-recording-app (or dev server isn’t running). From this repo run `npm run dev` (any free port). Without `BASE_URL`, the smoke script scans ports 3000–3020 for `/api/health`."
        : "";
    fail(
      step,
      `Not JSON (${res.status}): ${text.slice(0, 500)}${wrongAppHint}`,
    );
  }
  if (!res.ok) {
    let hint = "";
    if (step === "Health check" && body?.code === "42501") {
      hint =
        "\n\nHint: Postgres said “permission denied” (42501). Usually the **service role** key in `.env.local` is wrong, missing, or accidentally set to the **anon** key. Fix env, restart `npm run dev`, try again.";
    }
    if (step === "Health check" && body?.supabase === "misconfigured") {
      hint =
        "\n\nHint: Copy URL + keys from Supabase → Project Settings → API into `.env.local`, then restart the dev server.";
    }
    fail(step, `${res.status} ${res.statusText}\n${JSON.stringify(body, null, 2)}${hint}`);
  }
  return body;
}

async function main() {
  const base = await resolveBaseUrl();
  const usedScan = !process.env.BASE_URL?.trim();
  console.log(
    `Smoke test → ${base}${usedScan ? " (auto-detected; set BASE_URL to pin a port)\n" : "\n"}`,
  );

  const health = await json(
    await fetch(`${base}/api/health`),
    "Health check",
  );
  if (!health.ok) fail("Health check", health);
  console.log("✓ App responds and can reach Supabase (health)");

  const project = await json(
    await fetch(`${base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `smoke ${new Date().toISOString()}`,
        description: "automated note-001 smoke",
      }),
    }),
    "Create project",
  );
  const projectId = project.id;
  console.log("✓ Created project");

  const list = await json(await fetch(`${base}/api/projects`), "List projects");
  if (!Array.isArray(list)) fail("List projects", "Expected an array");
  const found = list.some((p) => p.id === projectId);
  if (!found) fail("List includes new project", { projectId, listLength: list.length });
  console.log("✓ List projects includes new row");

  await json(
    await fetch(`${base}/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "patched by smoke test" }),
    }),
    "Patch project",
  );
  console.log("✓ Patch project");

  const rec = await json(
    await fetch(`${base}/api/projects/${projectId}/recordings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioMimeType: "audio/webm" }),
    }),
    "Create recording (signed upload)",
  );
  const recordingId = rec.recordingId;
  const signedUrl = rec.signedUpload?.signedUrl;
  if (!recordingId || !signedUrl)
    fail("Create recording", "Missing recordingId or signedUpload.signedUrl");

  const fakeAudio = Buffer.from("RIFF....WEBM-smoke-test-bytes");
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "audio/webm" },
    body: fakeAudio,
  });
  if (!putRes.ok) {
    const errText = await putRes.text();
    fail(
      "Upload file to Supabase (signed URL)",
      `${putRes.status} ${putRes.statusText}\n${errText.slice(0, 800)}`,
    );
  }
  console.log("✓ Uploaded test audio to storage");

  const readPayload = await json(
    await fetch(`${base}/api/recordings/${recordingId}/signed-audio?expiresIn=3600`),
    "Get signed read URL",
  );
  const readUrl = readPayload.signedUrl;
  if (!readUrl) fail("Signed read URL", readPayload);

  const fileRes = await fetch(readUrl);
  if (!fileRes.ok) {
    fail("Download from signed read URL", `${fileRes.status} ${fileRes.statusText}`);
  }
  const downloaded = Buffer.from(await fileRes.arrayBuffer());
  if (!downloaded.equals(fakeAudio)) {
    fail("Downloaded bytes match upload", {
      uploaded: fakeAudio.length,
      downloaded: downloaded.length,
    });
  }
  console.log("✓ Signed read URL returns same bytes as upload");

  console.log("\nAll checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
