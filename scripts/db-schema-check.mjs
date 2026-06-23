#!/usr/bin/env node
import "./load-env-local.mjs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function trySelect(table, cols = "*") {
  const { data, error, count } = await supabase
    .from(table)
    .select(cols, { count: "exact", head: cols === "*" })
    .limit(1);
  return { data, error: error?.message ?? null, count };
}

const tables = ["projects", "items", "note_recordings", "contexts", "outputs", "tasks"];

console.log("=== Table probes ===\n");
for (const t of tables) {
  const r = await trySelect(t);
  console.log(`${t}:`, r.error ? `ERROR — ${r.error}` : `OK (${r.count ?? "?"} rows)`);
}

console.log("\n=== Column probes (note_recordings) ===\n");
for (const col of ["item_id", "project_id", "cleaned_transcript_text"]) {
  const r = await trySelect("note_recordings", `id, ${col}`);
  console.log(`  ${col}:`, r.error ? `missing — ${r.error}` : "exists");
}

console.log("\n=== Column probes (projects) ===\n");
for (const col of ["context_id", "master_transcript", "processing_template"]) {
  const r = await trySelect("projects", `id, ${col}`);
  console.log(`  ${col}:`, r.error ? `missing — ${r.error}` : "exists");
}

console.log("\n=== Column probes (items) ===\n");
for (const col of ["id", "project_id", "master_transcript"]) {
  const r = await trySelect("items", `id, ${col}`);
  console.log(`  items.${col}:`, r.error ? `missing — ${r.error}` : "exists");
}
