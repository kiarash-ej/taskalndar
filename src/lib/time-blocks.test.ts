import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedDb, OTHER, OWNER } from "./test-db";

let db: PGlite;

beforeAll(async () => { db = await migratedDb(); }, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub = '${OWNER}';`);
});
afterEach(async () => { await db.exec("rollback"); });

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows;
}

async function rejects(sql: string, params: unknown[], error: RegExp) {
  await db.exec("savepoint expect_error");
  await expect(db.query(sql, params)).rejects.toThrow(error);
  await db.exec("rollback to savepoint expect_error");
}

// 2026-10-13 is a Tuesday; Tehran is UTC+03:30.
const insertBlock = `insert into public.time_blocks
  (user_id, day, start_at, end_at, title, description, tags, amount, unit, cost, source)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`;

function block(over: Record<string, unknown> = {}) {
  const b = {
    user_id: OWNER,
    day: "2026-10-13",
    start_at: "2026-10-13T16:00:00+03:30",
    end_at: "2026-10-13T18:00:00+03:30",
    title: "درس",
    description: "فصل ۳ ریاضی",
    tags: ["درس", "دانشگاه"],
    amount: null,
    unit: null,
    cost: null,
    source: "manual",
    ...over,
  };
  return [b.user_id, b.day, b.start_at, b.end_at, b.title, b.description, b.tags, b.amount, b.unit, b.cost, b.source];
}

describe("time_blocks", () => {
  it("stores a block with its details, tags, amount and cost", async () => {
    await db.query(insertBlock, block({ amount: 30, unit: "صفحه", cost: 50000 }));
    expect(await rows(`select day::text, title, description, tags, amount, unit, cost, done, source
      from public.time_blocks`)).toEqual([{
      day: "2026-10-13", title: "درس", description: "فصل ۳ ریاضی", tags: ["درس", "دانشگاه"],
      amount: "30", unit: "صفحه", cost: "50000", done: false, source: "manual",
    }]);
  });

  it("allows a block that ends exactly at the day's midnight", async () => {
    await db.query(insertBlock, block({ start_at: "2026-10-13T22:00:00+03:30", end_at: "2026-10-14T00:00:00+03:30" }));
  });

  it.each([
    ["ending before it starts", { end_at: "2026-10-13T15:00:00+03:30" }],
    ["starting on another Tehran day", { start_at: "2026-10-12T23:00:00+03:30" }],
    ["crossing midnight", { start_at: "2026-10-13T23:00:00+03:30", end_at: "2026-10-14T01:00:00+03:30" }],
    ["an empty title", { title: "  " }],
    ["untrimmed tags", { tags: [" درس"] }],
    ["duplicate tags", { tags: ["درس", "درس"] }],
    ["empty tags", { tags: [""] }],
    ["more than 10 tags", { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
    ["a negative cost", { cost: -1 }],
    ["a negative amount", { amount: -1 }],
    ["a unit without an amount", { unit: "صفحه" }],
    ["an unknown source", { source: "import" }],
  ])("rejects %s", async (_name, over) => {
    await rejects(insertBlock, block(over), /check constraint/);
  });

  it("keeps blocks private and refreshes updated_at", async () => {
    await db.query(insertBlock, block());
    await db.query("update public.time_blocks set updated_at = '2000-01-01'");
    expect(await rows("select updated_at > '2001-01-01' as fresh from public.time_blocks")).toEqual([{ fresh: true }]);
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'`);
    expect(await rows("select * from public.time_blocks")).toEqual([]);
    await rejects(insertBlock, block(), /row-level security/);
  });

  it("suggests the user's own tags, most used first", async () => {
    await db.query(insertBlock, block({ tags: ["درس", "دانشگاه"] }));
    await db.query(insertBlock, block({ tags: ["درس"] }));
    await db.query(insertBlock, block({ tags: ["ورزش"] }));
    expect(await rows("select tag, uses::int from public.user_tags()")).toEqual([
      { tag: "درس", uses: 2 },
      { tag: "دانشگاه", uses: 1 },
      { tag: "ورزش", uses: 1 },
    ]);
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'`);
    expect(await rows("select * from public.user_tags()")).toEqual([]);
  });
});

describe("day templates", () => {
  async function template(name = "روز کاری") {
    const [{ id }] = await rows(
      "insert into public.day_templates (user_id, name) values ($1, $2) returning id", [OWNER, name],
    ) as { id: string }[];
    await db.query(`insert into public.day_template_blocks (template_id, user_id, start_time, end_time, title, tags)
      values ($1, $2, '08:00', '10:00', 'کار', '{کار}'), ($1, $2, '22:00', '24:00', 'مطالعه', '{درس}')`, [id, OWNER]);
    return id;
  }

  it("copies a template's blocks onto a day, in Tehran time", async () => {
    const id = await template();
    const created = await rows("select title from public.apply_day_template($1, '2026-10-13')", [id]);
    expect(created).toEqual([{ title: "کار" }, { title: "مطالعه" }]);
    const tehran = (column: string) => `to_char(${column} at time zone 'Asia/Tehran', 'YYYY-MM-DD HH24:MI')`;
    expect(await rows(`select day::text, title, tags, ${tehran("start_at")} as starts, ${tehran("end_at")} as ends
      from public.time_blocks order by start_at`)).toEqual([
      { day: "2026-10-13", title: "کار", tags: ["کار"], starts: "2026-10-13 08:00", ends: "2026-10-13 10:00" },
      { day: "2026-10-13", title: "مطالعه", tags: ["درس"], starts: "2026-10-13 22:00", ends: "2026-10-14 00:00" },
    ]);
  });

  it("rejects template blocks that end before they start", async () => {
    const id = await template();
    await rejects(`insert into public.day_template_blocks (template_id, user_id, start_time, end_time, title)
      values ($1, $2, '10:00', '09:00', 'x')`, [id, OWNER], /check constraint/);
  });

  it("keeps templates private: no reading, applying or adding blocks to another user's", async () => {
    const id = await template();
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'`);
    expect(await rows("select * from public.day_templates")).toEqual([]);
    await rejects("select * from public.apply_day_template($1, '2026-10-13')", [id], /Template not found/);
    await rejects(`insert into public.day_template_blocks (template_id, user_id, start_time, end_time, title)
      values ($1, $2, '10:00', '11:00', 'x')`, [id, OTHER], /foreign key/);
  });

  it("denies anonymous callers", async () => {
    const id = await template();
    await db.exec("set local role anon");
    await rejects("select * from public.apply_day_template($1, '2026-10-13')", [id], /permission denied/);
    await rejects("select * from public.user_tags()", [], /permission denied/);
  });
});
