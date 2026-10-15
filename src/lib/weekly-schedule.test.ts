import type { PGlite } from "@electric-sql/pglite";
import { jalaaliWeekday } from "@taskalndar/core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, isoToDate } from "./dates";
import { migratedDb, OTHER, OWNER } from "./test-db";

let db: PGlite;
let today: string;
let todayWeekday: number;

beforeAll(async () => {
  db = await migratedDb();
  today = (await db.query<{ day: string }>("select (now() at time zone 'Asia/Tehran')::date::text as day")).rows[0].day;
  todayWeekday = jalaaliWeekday(isoToDate(today));
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

async function insertTask(weekdays: number[] | null = null, recurring = true, date = addDays(today, -7)) {
  return (await db.query<{ id: string }>(
    "insert into public.tasks (user_id, title, is_recurring, date, weekdays) values ($1, 't', $2, $3, $4) returning id",
    [OWNER, recurring, date, weekdays],
  )).rows[0].id;
}

async function change(id: string, recurring: boolean, weekdays: number[] | null, day = today) {
  return (await db.query<{ id: string }>(
    "select public.update_task_schedule($1, 'updated', $2, $3, $4) as id", [id, recurring, day, weekdays],
  )).rows[0].id;
}

const otherWeekday = () => (todayWeekday + 1) % 7;

describe("jalali_weekday", () => {
  it("matches packages/core for a whole week", async () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays("2026-09-26", i));
    const result = await rows(
      "select public.jalali_weekday(d::date) as w from unnest($1::text[]) d", [days],
    );
    expect(result.map((r) => (r as { w: number }).w)).toEqual(days.map((d) => jalaaliWeekday(isoToDate(d))));
  });
});

describe("tasks.weekdays", () => {
  it("accepts canonical weekday sets on recurring tasks", async () => {
    await insertTask([0, 2, 4]);
    await insertTask([6]);
    expect(await rows("select weekdays from public.tasks order by weekdays")).toEqual([
      { weekdays: [0, 2, 4] },
      { weekdays: [6] },
    ]);
  });

  it.each([
    ["unsorted", [2, 0], true],
    ["duplicated", [1, 1], true],
    ["out of range", [7], true],
    ["negative", [-1], true],
    ["empty", [], true],
    ["every day (use null)", [0, 1, 2, 3, 4, 5, 6], true],
    ["on a one-time task", [1], false],
  ])("rejects weekdays that are %s", async (_name, weekdays, recurring) => {
    await rejects(
      "insert into public.tasks (user_id, title, is_recurring, weekdays) values ($1, 't', $2, $3)",
      [OWNER, recurring, weekdays], /check constraint/,
    );
  });
});

describe("update_task_schedule with weekdays", () => {
  it("versions a daily task into a weekly one and moves today's completion when today is included", async () => {
    const id = await insertTask();
    await db.query("insert into public.task_completions (task_id, user_id, date) values ($1, $2, $3), ($1, $2, $4)",
      [id, OWNER, addDays(today, -1), today]);
    const newId = await change(id, true, [todayWeekday]);
    expect(newId).not.toBe(id);
    expect(await rows("select weekdays, date::text from public.tasks where id = $1", [newId]))
      .toEqual([{ weekdays: [todayWeekday], date: today }]);
    expect(await rows("select task_id, date::text from public.task_completions order by date")).toEqual([
      { task_id: id, date: addDays(today, -1) },
      { task_id: newId, date: today },
    ]);
  });

  it("leaves today's completion on the old version when the new weekdays skip today", async () => {
    const id = await insertTask();
    await db.query("insert into public.task_completions (task_id, user_id, date) values ($1, $2, $3)", [id, OWNER, today]);
    await change(id, true, [otherWeekday()]);
    expect(await rows("select task_id from public.task_completions")).toEqual([{ task_id: id }]);
  });

  it("normalizes the weekdays it is given", async () => {
    const id = await insertTask([1, 3]);
    expect(await change(id, true, [3, 1, 3])).toBe(id);
    expect(await rows("select title, weekdays from public.tasks")).toEqual([{ title: "updated", weekdays: [1, 3] }]);

    const daily = await insertTask();
    expect(await change(daily, true, [6, 5, 4, 3, 2, 1, 0])).toBe(daily);
    expect(await rows("select weekdays from public.tasks where id = $1", [daily])).toEqual([{ weekdays: null }]);
  });

  it("keeps the 4-argument call working as a daily schedule", async () => {
    const id = await insertTask();
    const [{ same }] = await rows(
      "select public.update_task_schedule($1, 'renamed', true, $2) = $1 as same", [id, today],
    ) as { same: boolean }[];
    expect(same).toBe(true);
  });

  it.each([
    ["weekdays on a one-time task", false, [1]],
    ["a weekday out of range", true, [9]],
    ["an empty weekday set", true, []],
  ])("rejects %s", async (_name, recurring, weekdays) => {
    const id = await insertTask();
    await db.exec("savepoint expect_error");
    await expect(change(id, recurring as boolean, weekdays as number[])).rejects.toThrow("Invalid task");
    await db.exec("rollback to savepoint expect_error");
  });

  it("still rejects other users and anonymous callers", async () => {
    const id = await insertTask();
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'; savepoint other_user;`);
    await expect(change(id, true, [1])).rejects.toThrow("Task not found");
    await db.exec("rollback to savepoint other_user; set local role anon;");
    await expect(change(id, true, [1])).rejects.toThrow(/permission denied/);
  });
});

describe("goals.period", () => {
  it("accepts monthly and weekly goals only", async () => {
    await db.query("insert into public.goals (user_id, title, target_value, unit, period) values ($1, 'g', 5, 'h', 'weekly')", [OWNER]);
    expect(await rows("select period from public.goals")).toEqual([{ period: "weekly" }]);
    await rejects(
      "insert into public.goals (user_id, title, target_value, unit, period) values ($1, 'g', 5, 'h', 'daily')",
      [OWNER], /check constraint/,
    );
  });
});
