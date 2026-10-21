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

const EVERY_NIGHT = [0, 1, 2, 3, 4, 5, 6];

async function save(weekdays: number[], bed: string, wake: string) {
  await db.query("select public.save_sleep_schedule($1::smallint[], $2::time[], $3::time[])", [
    weekdays,
    weekdays.map(() => bed),
    weekdays.map(() => wake),
  ]);
}

// a night's blocks as "day start-end" in Tehran time
async function night(n: string) {
  const result = await rows(
    `select day::text || ' ' || to_char(start_at at time zone 'Asia/Tehran', 'HH24:MI') || '-' ||
       to_char(end_at at time zone 'Asia/Tehran', 'HH24:MI') as span, title, tags, source
     from public.time_blocks where sleep_night = $1 order by start_at`,
    [n],
  );
  return result as { span: string; title: string; tags: string[]; source: string }[];
}

describe("set_sleep_night", () => {
  it("cuts a night at midnight into one sleep block per day", async () => {
    await db.query("select public.set_sleep_night($1, $2, $3, $4)", [
      OWNER, "2026-10-13", "2026-10-13T23:00:00+03:30", "2026-10-14T07:00:00+03:30",
    ]);
    expect(await night("2026-10-13")).toEqual([
      { span: "2026-10-13 23:00-00:00", title: "خواب", tags: ["خواب"], source: "sleep" },
      { span: "2026-10-14 00:00-07:00", title: "خواب", tags: ["خواب"], source: "sleep" },
    ]);
  });

  it("replaces the night's blocks and adds nothing for a wake time of exactly midnight", async () => {
    const set = "select public.set_sleep_night($1, $2, $3, $4)";
    await db.query(set, [OWNER, "2026-10-13", "2026-10-13T23:00:00+03:30", "2026-10-14T07:00:00+03:30"]);
    await db.query(set, [OWNER, "2026-10-13", "2026-10-13T21:00:00+03:30", "2026-10-14T00:00:00+03:30"]);
    expect((await night("2026-10-13")).map((b) => b.span)).toEqual(["2026-10-13 21:00-00:00"]);
  });

  it("rejects backwards or overlong nights and other users' nights", async () => {
    const set = "select public.set_sleep_night($1, $2, $3, $4)";
    await rejects(set, [OWNER, "2026-10-13", "2026-10-14T07:00:00+03:30", "2026-10-13T23:00:00+03:30"], /Invalid sleep/);
    await rejects(set, [OWNER, "2026-10-13", "2026-10-13T08:00:00+03:30", "2026-10-14T07:00:00+03:30"], /Invalid sleep/);
    await rejects(set, [OTHER, "2026-10-13", "2026-10-13T23:00:00+03:30", "2026-10-14T07:00:00+03:30"], /Not allowed/);
  });

  it("is not callable by anonymous visitors", async () => {
    await db.exec("set local role anon");
    await rejects("select public.set_sleep_night($1, $2, $3, $4)", [
      OWNER, "2026-10-13", "2026-10-13T23:00:00+03:30", "2026-10-14T07:00:00+03:30",
    ], /permission denied/);
  });
});

describe("sleep schedule", () => {
  it("replaces the weekly schedule and leaves blocks alone", async () => {
    await db.query("select public.set_sleep_night($1, $2, $3, $4)", [
      OWNER, "2026-10-13", "2026-10-13T23:00:00+03:30", "2026-10-14T07:00:00+03:30",
    ]);
    await save(EVERY_NIGHT, "23:00", "07:00");
    await save([1, 3], "22:30", "06:30");
    expect(await rows("select weekday, bedtime::text, wake_time::text from public.sleep_schedules order by weekday")).toEqual([
      { weekday: 1, bedtime: "22:30:00", wake_time: "06:30:00" },
      { weekday: 3, bedtime: "22:30:00", wake_time: "06:30:00" },
    ]);
    // nothing is created or removed on the planner by the schedule itself
    expect(await night("2026-10-13")).toHaveLength(2);
    expect(await rows("select count(*)::int as n from public.time_blocks")).toEqual([{ n: 2 }]);
  });

  it("turns off with no nights", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    await save([], "23:00", "07:00");
    expect(await rows("select 1 from public.sleep_schedules")).toEqual([]);
  });

  it("rejects nights shorter than an hour or longer than 16 hours", async () => {
    await rejects(
      "select public.save_sleep_schedule('{0}'::smallint[], '{23:00}'::time[], '{23:30}'::time[])", [],
      /sleep_schedules_length_check/,
    );
    await rejects(
      "select public.save_sleep_schedule('{0}'::smallint[], '{12:00}'::time[], '{07:00}'::time[])", [],
      /sleep_schedules_length_check/,
    );
    await rejects(
      "select public.save_sleep_schedule('{0,1}'::smallint[], '{23:00}'::time[], '{07:00}'::time[])", [],
      /Invalid schedule/,
    );
  });

  it("keeps each user's schedule and turned-down nights to themselves", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    await db.query("insert into public.sleep_skips (user_id, night) values ($1, '2026-10-13')", [OWNER]);
    await rejects("insert into public.sleep_skips (user_id, night) values ($1, '2026-10-13')", [OTHER], /row-level security/);
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'`);
    expect(await rows("select 1 from public.sleep_schedules")).toEqual([]);
    expect(await rows("select 1 from public.sleep_skips")).toEqual([]);
  });
});
