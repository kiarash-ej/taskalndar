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
  await db.exec(readFileSync(supabaseDir + "tests/supabase-stub.sql", "utf8"));
  await db.exec(`insert into auth.users values ('${OWNER}'), ('${OTHER}');`);
  const migrations = supabaseDir + "migrations/";
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(migrations + file, "utf8"));
  }
  return db;
}

// Runs `operation` as that user (null: an anonymous visitor; "service_role":
// the server's admin key) and rolls back.
export async function asUser(db: PGlite, userId: string | null, operation: () => Promise<void>) {
  const role = userId === null ? "anon" : userId === "service_role" ? "service_role" : "authenticated";
  const sub = role === "authenticated" ? userId : "";
  await db.exec(`begin; set local role ${role}; set local request.jwt.claim.sub = '${sub}';`);
  try {
    await operation();
  } finally {
    await db.exec("rollback");
  }
}
