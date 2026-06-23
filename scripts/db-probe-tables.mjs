#!/usr/bin/env node
/**
 * Inspect public schema via Supabase REST (service role). Read-only.
 */
import "./load-env-local.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function probeTable(name) {
  const { error, count } = await supabase
    .from(name)
    .select("*", { count: "exact", head: true });
  if (!error) return { exists: true, count: count ?? 0, error: null };
  const msg = error.message || "";
  if (msg.includes("does not exist") || error.code === "42P01") {
    return { exists: false, count: 0, error: null };
  }
  return { exists: false, count: 0, error: msg };
}

async function samplePaths() {
  const { data, error } = await supabase
    .from("note_recordings")
    .select("audio_storage_path")
    .limit(3);
  if (error) return { error: error.message, paths: [] };
  return { error: null, paths: (data ?? []).map((r) => r.audio_storage_path) };
}

const tables = [
  "projects",
  "items",
  "note_recordings",
  "transcript_chunks",
  "contexts",
  "outputs",
  "tasks",
];

console.log("=== Supabase table probe ===\n");
const results = {};
for (const t of tables) {
  results[t] = await probeTable(t);
  const r = results[t];
  if (r.error) {
    console.log(`${t}: ERROR — ${r.error}`);
  } else if (r.exists) {
    console.log(`${t}: exists (${r.count} rows)`);
  } else {
    console.log(`${t}: missing`);
  }
}

const paths = await samplePaths();
if (!paths.error && paths.paths.length) {
  console.log("\n=== Sample audio_storage_path (read-only) ===");
  for (const p of paths.paths) console.log(`  ${p}`);
}

const migrated = results.items?.exists && results.contexts?.exists;
const preMigration = results.projects?.exists && !results.items?.exists;

console.log("\n=== Assessment ===");
if (migrated) {
  console.log("note-008 migration appears APPLIED.");
} else if (preMigration) {
  console.log("note-008 migration NOT applied (legacy projects table present).");
} else {
  console.log("Unexpected schema state — review manually.");
}

process.exit(migrated ? 0 : preMigration ? 2 : 1);
