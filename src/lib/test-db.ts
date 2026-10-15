import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Test-only: a PGlite database with Supabase's auth/storage stand-ins and every
// committed migration applied, for checking schema, RLS and SQL functions.

export const OWNER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
export const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const supabaseDir = fileURLToPath(new URL("../../supabase/", import.meta.url));

export async function migratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role authenticated;
    create role anon;
    grant usage on schema public, auth to authenticated, anon;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, anon;
    insert into auth.users values ('${OWNER}'), ('${OTHER}');
  `);
  await db.exec(readFileSync(supabaseDir + "tests/storage-stub.sql", "utf8"));
  const migrations = supabaseDir + "migrations/";
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(migrations + file, "utf8"));
  }
  return db;
}

// Runs `operation` as that user (null: an anonymous visitor) and rolls back.
export async function asUser(db: PGlite, userId: string | null, operation: () => Promise<void>) {
  const role = userId === null ? "anon" : "authenticated";
  await db.exec(`begin; set local role ${role}; set local request.jwt.claim.sub = '${userId ?? ""}';`);
  try {
    await operation();
  } finally {
    await db.exec("rollback");
  }
}
