import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { migratedDb, OTHER, OWNER } from "./test-db";

// claim_due_reminders and the reminder columns. now() is fixed within each
// test's transaction, so blocks are placed relative to it, and created_at is
// set an hour back (blocks are planned before they start).

let db: PGlite;

beforeAll(async () => { db = await migratedDb(); }, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec("begin");
  await db.query(
    `insert into public.notification_channels (user_id, kind, chat_id, linked_at, link_code, link_code_expires_at)
     values ($1, 'bale', '42', now(), null, null)`,
    [OWNER],
  );
  await db.query("insert into public.reminder_settings (user_id, lead_minutes) values ($1, 10)", [OWNER]);
});
afterEach(async () => { await db.exec("rollback"); });

// a block starting `inMinutes` from now, an hour long, made an hour ago
async function block(inMinutes: number, over: Record<string, unknown> = {}) {
  const b = { user_id: OWNER, title: "درس", remind: true, reminder_minutes: null, done: false, ...over };
  const { rows } = await db.query<{ id: string }>(
    `insert into public.time_blocks (user_id, day, start_at, end_at, title, remind, reminder_minutes, done, created_at)
     select $1, (s at time zone 'Asia/Tehran')::date, s, s + interval '1 minute', $2, $3, $4, $5, now() - interval '1 hour'
     from (select now() + make_interval(mins => $6) as s) t
     returning id`,
    [b.user_id, b.title, b.remind, b.reminder_minutes, b.done, inMinutes],
  );
  return rows[0].id;
}

async function claim() {
  await db.exec("savepoint claim; set local role service_role;");
  const { rows } = await db.query<{ block_id: string; title: string; is_sleep: boolean }>(
    "select block_id, title, is_sleep from public.claim_due_reminders()",
  );
  await db.exec("reset role; release savepoint claim;");
  return rows;
}

describe("claim_due_reminders", () => {
  it("claims blocks within the user's lead time once", async () => {
    const soon = await block(8);
    await block(30);
    expect(await claim()).toEqual([{ block_id: soon, title: "درس", is_sleep: false }]);
    expect(await claim()).toEqual([]);
  });

  it("uses a block's own lead time and honors turning it off", async () => {
    const early = await block(45, { reminder_minutes: 60 });
    await block(5, { remind: false });
    await block(5, { reminder_minutes: 0 });
    expect((await claim()).map((r) => r.block_id)).toEqual([early]);
  });

  it("skips done, stale and after-the-fact blocks", async () => {
    await block(5, { done: true });
    await block(-15);
    // logged after it started
    await db.query(
      `insert into public.time_blocks (user_id, day, start_at, end_at, title)
       select $1, (s at time zone 'Asia/Tehran')::date, s, s + interval '1 minute', 'x'
       from (select now() - interval '2 minutes' as s) t`,
      [OWNER],
    );
    expect(await claim()).toEqual([]);
  });

  it("needs reminders on and a linked chat", async () => {
    await block(5, { user_id: OTHER });
    await db.query("update public.reminder_settings set enabled = false where user_id = $1", [OWNER]);
    await block(5);
    expect(await claim()).toEqual([]);
  });

  it("reminds again after the block moves", async () => {
    const id = await block(5);
    expect(await claim()).toHaveLength(1);
    await db.query("update public.time_blocks set start_at = start_at - interval '1 minute' where id = $1", [id]);
    expect(await claim()).toHaveLength(1);
    await db.query("update public.time_blocks set title = 'y' where id = $1", [id]);
    expect(await claim()).toEqual([]);
  });

  it("reminds only at the start of a night's sleep, if wanted", async () => {
    const night = (await db.query<{ d: string }>("select (now() at time zone 'Asia/Tehran')::date::text as d")).rows[0].d;
    // two pieces of one night, both within the lead time
    await db.query(
      `insert into public.time_blocks (user_id, day, start_at, end_at, title, source, sleep_night, created_at)
       select $1, (s at time zone 'Asia/Tehran')::date, s, s + interval '1 minute', 'خواب', 'sleep', $2, now() - interval '1 hour'
       from (select now() + make_interval(mins => m) as s from unnest(array[3, 6]) m) t`,
      [OWNER, night],
    );
    expect(await claim()).toEqual([expect.objectContaining({ title: "خواب", is_sleep: true })]);
    await db.query("update public.time_blocks set reminded_at = null");
    await db.query("update public.reminder_settings set include_sleep = false");
    expect(await claim()).toEqual([]);
  });

  it("is only for the server", async () => {
    await db.exec(`savepoint s; set local role authenticated; set local request.jwt.claim.sub = '${OWNER}';`);
    await expect(db.query("select * from public.claim_due_reminders()")).rejects.toThrow(/permission denied/);
    await db.exec("rollback to savepoint s; reset role;");
  });

  it("validates lead times", async () => {
    await db.exec("savepoint s");
    await expect(db.query("update public.reminder_settings set lead_minutes = 2000")).rejects.toThrow(/check/);
    await db.exec("rollback to savepoint s");
    await expect(block(5, { reminder_minutes: -1 })).rejects.toThrow(/check/);
  });
});
