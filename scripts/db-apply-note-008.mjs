#!/usr/bin/env node
/**
 * Apply note-008 migration via direct Postgres. DB only — does NOT touch storage.
 *
 * Requires in .env.local (save the file first!):
 *   SUPABASE_DB_PASSWORD  — Database password from Supabase Dashboard → Settings → Database
 *   NEXT_PUBLIC_SUPABASE_URL
 *
 * Or set SUPABASE_DB_URL to the full connection string.
 *
 *   node scripts/db-apply-note-008.mjs
 */
import "./load-env-local.mjs";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function connectionString() {
  const direct = process.env.SUPABASE_DB_URL?.trim();
  if (direct) return direct;

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!password || !url) {
    throw new Error(
      "Add SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) to .env.local and save the file.",
    );
  }
  const ref = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!ref) throw new Error("Cannot parse project ref from NEXT_PUBLIC_SUPABASE_URL");
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

async function tableExists(client, name) {
  const { rows } = await client.query(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    )`,
    [name],
  );
  return Boolean(rows[0]?.exists);
}

async function main() {
  const client = new pg.Client({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const hasItems = await tableExists(client, "items");
    const hasContexts = await tableExists(client, "contexts");
    if (hasItems && hasContexts) {
      console.log("note-008 already applied. Nothing to do.");
      return;
    }

    const hasLegacyProjects = await tableExists(client, "projects");
    if (!hasLegacyProjects) {
      throw new Error("Expected legacy public.projects table. Apply earlier migrations first.");
    }

    const sql = readFileSync(
      resolve(root, "supabase/migrations/20250320120600_note008_items_projects_hierarchy.sql"),
      "utf8",
    );

    console.log("Applying note-008 (database only, storage untouched)…");
    await client.query(sql);
    console.log("Done.");

    const { rows: counts } = await client.query(`
      select
        (select count(*)::int from public.items) as items,
        (select count(*)::int from public.projects) as projects,
        (select count(*)::int from public.note_recordings) as recordings
    `);
    console.log("Row counts:", counts[0]);

    const { rows: paths } = await client.query(
      `select audio_storage_path from public.note_recordings limit 2`,
    );
    if (paths.length) {
      console.log("Sample storage paths (unchanged):", paths.map((r) => r.audio_storage_path));
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
