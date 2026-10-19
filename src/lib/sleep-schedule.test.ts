import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { migratedDb, OTHER, OWNER } from "./test-db";

let db: PGlite;
let today: string;

beforeAll(async () => {
  db = await migratedDb();
  today = (await db.query<{ day: string }>("select (now() at time zone 'Asia/Tehran')::date::text as day")).rows[0].day;
}, 30_000);
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

async function fill(until: string) {
  return (await db.query<{ n: number }>("select public.fill_sleep_blocks($1) as n", [until])).rows[0].n;
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
  it("does nothing before a schedule is saved", async () => {
    expect(await fill(addDays(today, 3))).toBe(0);
    expect(await rows("select 1 from public.time_blocks")).toEqual([]);
  });

  it("fills upcoming nights at least two weeks ahead, a night at most once", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    const created = await fill(addDays(today, 3));
    // tonight through two weeks from today; nights already started are skipped
    expect(created).toBeGreaterThanOrEqual(14);
    expect(created).toBeLessThanOrEqual(16);
    const tomorrow = addDays(today, 1);
    expect((await night(tomorrow)).map((b) => b.span)).toEqual([
      `${tomorrow} 23:00-00:00`,
      `${addDays(tomorrow, 1)} 00:00-07:00`,
    ]);
    expect(await fill(addDays(today, 3))).toBe(0);
    expect(await rows("select count(*)::int as n from public.time_blocks where sleep_night = $1", [tomorrow]))
      .toEqual([{ n: 2 }]);
  });

  it("puts a bedtime before noon after the night's midnight", async () => {
    await save(EVERY_NIGHT, "01:30", "09:00");
    await fill(today);
    const n = addDays(today, 2);
    expect((await night(n)).map((b) => b.span)).toEqual([`${addDays(n, 1)} 01:30-09:00`]);
  });

  it("only schedules the chosen nights of the week", async () => {
    const weekday = (await rows("select public.jalali_weekday($1) as w", [addDays(today, 3)]))[0] as { w: number };
    await save([weekday.w], "22:00", "06:00");
    await fill(addDays(today, 20));
    const nights = await rows("select distinct sleep_night::text as n from public.time_blocks order by 1");
    expect(nights).toContainEqual({ n: addDays(today, 3) });
    expect(nights).not.toContainEqual({ n: addDays(today, 4) });
  });

  it("keeps a deleted sleep block deleted", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    await fill(today);
    const n = addDays(today, 2);
    await db.query("delete from public.time_blocks where sleep_night = $1", [n]);
    await fill(addDays(today, 30));
    expect(await night(n)).toEqual([]);
  });

  it("re-plans untouched future nights on a new schedule and keeps edited ones", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    await fill(today);
    const edited = addDays(today, 2);
    const untouched = addDays(today, 3);
    // now() is fixed within the test's transaction, so backdate created_at to
    // make the edit look later, as it is in real use
    await db.query(
      `update public.time_blocks set description = 'دیر خوابیدم', created_at = created_at - interval '1 minute'
       where sleep_night = $1 and day = $1`,
      [edited],
    );
    await save(EVERY_NIGHT, "22:00", "06:00");
    await fill(today);
    expect((await night(edited)).map((b) => b.span)).toEqual([
      `${edited} 23:00-00:00`,
      `${addDays(edited, 1)} 00:00-07:00`,
    ]);
    expect((await night(untouched)).map((b) => b.span)).toEqual([
      `${untouched} 22:00-00:00`,
      `${addDays(untouched, 1)} 00:00-06:00`,
    ]);
  });

  it("removes upcoming untouched nights when turned off", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    await fill(today);
    await save([], "23:00", "07:00");
    await fill(addDays(today, 30));
    expect(await rows("select 1 from public.time_blocks where sleep_night > $1", [addDays(today, 1)])).toEqual([]);
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

  it("keeps each user's schedule to themselves", async () => {
    await save(EVERY_NIGHT, "23:00", "07:00");
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'`);
    expect(await rows("select 1 from public.sleep_schedules")).toEqual([]);
    expect(await rows("select 1 from public.sleep_settings")).toEqual([]);
    expect(await fill(addDays(today, 3))).toBe(0);
  });
});
