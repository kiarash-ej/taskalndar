import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, migratedDb, OTHER, OWNER } from "./test-db";

let db: PGlite;

beforeAll(async () => { db = await migratedDb(); }, 30_000);
afterAll(async () => { await db?.close(); });

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows;
}

// Expects the statement to fail without aborting the surrounding transaction.
async function rejects(sql: string, params: unknown[], error: RegExp) {
  await db.exec("savepoint expect_error");
  await expect(db.query(sql, params)).rejects.toThrow(error);
  await db.exec("rollback to savepoint expect_error");
}

describe("daily_notes", () => {
  it("keeps one note per day that the owner can rewrite", async () => {
    await asUser(db, OWNER, async () => {
      const upsert = `insert into public.daily_notes (user_id, day, body) values ($1, '2026-10-15', $2)
        on conflict (user_id, day) do update set body = excluded.body`;
      await db.query(upsert, [OWNER, "first"]);
      await db.query(upsert, [OWNER, "second"]);
      expect(await rows("select day::text, body from public.daily_notes")).toEqual([
        { day: "2026-10-15", body: "second" },
      ]);
    });
  });

  it("refreshes updated_at on every change", async () => {
    await asUser(db, OWNER, async () => {
      await db.query(`insert into public.daily_notes (user_id, day, body, updated_at)
        values ($1, '2026-10-15', 'a', '2000-01-01')`, [OWNER]);
      await db.query("update public.daily_notes set body = 'b'");
      expect(await rows("select updated_at > '2001-01-01' as fresh from public.daily_notes"))
        .toEqual([{ fresh: true }]);
    });
  });

  it("hides notes from other users and rejects writing under their id", async () => {
    await db.query("insert into public.daily_notes (user_id, day, body) values ($1, '2026-10-15', 'mine')", [OWNER]);
    await asUser(db, OTHER, async () => {
      expect(await rows("select * from public.daily_notes")).toEqual([]);
      await expect(db.query(
        "insert into public.daily_notes (user_id, day, body) values ($1, '2026-10-16', 'x')", [OWNER],
      )).rejects.toThrow(/row-level security/);
    });
    await asUser(db, null, async () => {
      expect(await rows("select * from public.daily_notes")).toEqual([]);
    });
    await db.exec("delete from public.daily_notes");
  });

  it("rejects notes longer than 10000 characters", async () => {
    await asUser(db, OWNER, async () => {
      await expect(db.query(
        "insert into public.daily_notes (user_id, day, body) values ($1, '2026-10-15', $2)",
        [OWNER, "x".repeat(10_001)],
      )).rejects.toThrow(/check constraint/);
    });
  });
});

describe("profiles", () => {
  const upsert = `insert into public.profiles (id, background_kind, background_value) values ($1, $2, $3)
    on conflict (id) do update set background_kind = excluded.background_kind,
      background_value = excluded.background_value`;

  it("starts with no background and lets the owner pick each kind", async () => {
    await asUser(db, OWNER, async () => {
      await db.query("insert into public.profiles (id) values ($1)", [OWNER]);
      expect(await rows("select background_kind, background_value from public.profiles"))
        .toEqual([{ background_kind: "none", background_value: null }]);
      await db.query(upsert, [OWNER, "color", "#1a2b3c"]);
      await db.query(upsert, [OWNER, "gradient", "sunset"]);
      await db.query(upsert, [OWNER, "image", `${OWNER}/bg.webp`]);
      expect(await rows("select background_kind from public.profiles")).toEqual([{ background_kind: "image" }]);
    });
  });

  it.each([
    ["color", "red"],
    ["color", null],
    ["gradient", "Sunset!"],
    ["image", `${OTHER}/bg.webp`],
    ["image", "bg.webp"],
    ["none", "#ffffff"],
    ["video", "x"],
  ])("rejects background %s = %s", async (kind, value) => {
    await asUser(db, OWNER, async () => {
      await expect(db.query(upsert, [OWNER, kind, value])).rejects.toThrow(/check constraint/);
    });
  });

  it("keeps each profile private to its user", async () => {
    await db.query("insert into public.profiles (id, background_kind, background_value) values ($1, 'color', '#000000')", [OWNER]);
    await asUser(db, OTHER, async () => {
      expect(await rows("select * from public.profiles")).toEqual([]);
      await rejects("insert into public.profiles (id) values ($1)", [OWNER], /row-level security/);
      await db.query("update public.profiles set background_value = '#ffffff'");
    });
    expect(await rows("select background_value from public.profiles")).toEqual([{ background_value: "#000000" }]);
    await db.exec("delete from public.profiles");
  });
});

describe("backgrounds storage bucket", () => {
  it("is private and limited to 5 MB images", async () => {
    expect(await rows("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'backgrounds'"))
      .toEqual([{
        public: false,
        file_size_limit: 5242880,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
      }]);
  });

  it("lets users write and read only inside their own folder", async () => {
    await asUser(db, OWNER, async () => {
      await db.query("insert into storage.objects (bucket_id, name, owner) values ('backgrounds', $1, $2)",
        [`${OWNER}/bg.webp`, OWNER]);
      await rejects("insert into storage.objects (bucket_id, name, owner) values ('backgrounds', $1, $2)",
        [`${OTHER}/bg.webp`, OWNER], /row-level security/);
      await db.query("update storage.objects set name = $1", [`${OWNER}/new.webp`]);
      await rejects("update storage.objects set name = $1", [`${OTHER}/new.webp`], /row-level security/);
      expect(await rows("select name from storage.objects")).toEqual([{ name: `${OWNER}/new.webp` }]);
    });

    await db.query("insert into storage.objects (bucket_id, name, owner) values ('backgrounds', $1, $2)",
      [`${OWNER}/bg.webp`, OWNER]);
    await asUser(db, OTHER, async () => {
      expect(await rows("select * from storage.objects")).toEqual([]);
      await db.query("delete from storage.objects");
    });
    await asUser(db, null, async () => {
      expect(await rows("select * from storage.objects")).toEqual([]);
    });
    expect(await rows("select count(*)::int as n from storage.objects")).toEqual([{ n: 1 }]);
    await db.exec("delete from storage.objects");
  });
});
