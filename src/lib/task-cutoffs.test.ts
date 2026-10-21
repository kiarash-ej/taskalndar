import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { OTHER, OWNER } from "./test-db";

// Issue #4: deleting and rescheduling a task whose old version ends on a
// future day, next to the replacement that starts then.

const supabaseDir = fileURLToPath(new URL("../../supabase/", import.meta.url));
const NEW_MIGRATION = "20261021220200_future_task_cutoffs.sql";
let db: PGlite;
let today: string;

async function dbUpTo(stopBefore: string | null) {
  const instance = new PGlite();
  await instance.exec(readFileSync(supabaseDir + "tests/supabase-stub.sql", "utf8"));
  await instance.exec(`insert into auth.users values ('${OWNER}'), ('${OTHER}');`);
  for (const file of readdirSync(supabaseDir + "migrations/").filter((f) => f.endsWith(".sql")).sort()) {
    if (file === stopBefore) break;
    await instance.exec(readFileSync(supabaseDir + "migrations/" + file, "utf8"));
  }
  return instance;
}

beforeAll(async () => {
  db = await dbUpTo(null);
  today = (await db.query<{ d: string }>("select (now() at time zone 'Asia/Tehran')::date::text as d")).rows[0].d;
}, 30_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub = '${OWNER}';`);
});
afterEach(async () => { await db.exec("rollback"); });

async function insertTask(date = addDays(today, -3), recurring = true) {
  return (await db.query<{ id: string }>(
    "insert into public.tasks (user_id, title, is_recurring, date) values ($1, 'ورزش', $2, $3) returning id",
    [OWNER, recurring, date],
  )).rows[0].id;
}

async function change(id: string, day: string, recurring = false, title = "ورزش", weekdays: number[] | null = null) {
  return (await db.query<{ id: string }>(
    "select public.update_task_schedule($1, $2, $3, $4, $5::smallint[]) as id",
    [id, title, recurring, day, weekdays],
  )).rows[0].id;
}

async function remove(id: string) {
  return (await db.query<{ r: string }>("select public.delete_task($1) as r", [id])).rows[0].r;
}

// a daily task changed to one-time from `inDays` days ahead: [old version, replacement]
async function futureChange(inDays = 5) {
  const old = await insertTask();
  const replacement = await change(old, addDays(today, inDays));
  return [old, replacement];
}

async function task(id: string) {
  const rows = (await db.query<{ date: string; cutoff: string | null; recurring: boolean; title: string; replaced_by: string | null }>(
    `select date::text, (archived_at at time zone 'Asia/Tehran')::date::text as cutoff, is_recurring as recurring, title, replaced_by
     from public.tasks where id = $1`,
    [id],
  )).rows;
  return rows[0] ?? null;
}

// tasks active on `day`, by the same rule as isTaskActiveOn
async function activeOn(day: string) {
  return (await db.query<{ id: string }>(
    `select id from public.tasks
     where (archived_at is null or $1::date < (archived_at at time zone 'Asia/Tehran')::date)
       and case when is_recurring then date <= $1::date else date = $1::date end`,
    [day],
  )).rows.map((r) => r.id);
}

describe("a future reschedule", () => {
  it("links the old version to its replacement", async () => {
    const [old, replacement] = await futureChange();
    expect(await task(old)).toMatchObject({ cutoff: addDays(today, 5), replaced_by: replacement });
    expect(await activeOn(today)).toEqual([old]);
    expect(await activeOn(addDays(today, 5))).toEqual([replacement]);
  });
});

describe("delete_task", () => {
  it("before the cutoff: ends the task today and removes the pending replacement", async () => {
    const [old, replacement] = await futureChange();
    expect(await remove(old)).toBe("archived");
    expect(await task(old)).toMatchObject({ cutoff: today, replaced_by: null });
    expect(await task(replacement)).toBeNull();
    for (const day of [today, addDays(today, 5), addDays(today, 9)]) expect(await activeOn(day)).toEqual([]);
  });

  it("keeps completed history when ending the task", async () => {
    const [old] = await futureChange();
    await db.query("insert into public.task_completions (task_id, user_id, date) values ($1, $2, $3)", [old, OWNER, addDays(today, -1)]);
    await remove(old);
    expect((await db.query("select date::text from public.task_completions where task_id = $1", [old])).rows)
      .toEqual([{ date: addDays(today, -1) }]);
  });

  it("on or after the cutoff: leaves an ended version as it was, again and again", async () => {
    for (const cutoff of [today, addDays(today, -2)]) {
      const old = await insertTask(addDays(today, -10));
      const replacement = await insertTask(cutoff, false);
      await db.query("update public.tasks set archived_at = ($2::date::timestamp at time zone 'Asia/Tehran'), replaced_by = $3 where id = $1",
        [old, cutoff, replacement]);
      expect(await remove(old)).toBe("unchanged");
      expect(await remove(old)).toBe("unchanged");
      expect(await task(old)).toMatchObject({ cutoff, replaced_by: replacement });
      expect(await task(replacement)).not.toBeNull();
    }
  });

  it("removes a task that hasn't started, with its own replacements", async () => {
    const future = await insertTask(addDays(today, 2));
    const next = await change(future, addDays(today, 6));
    expect(await remove(future)).toBe("deleted");
    expect(await task(future)).toBeNull();
    expect(await task(next)).toBeNull();
  });

  it("removing the replacement keeps the old version's cutoff", async () => {
    const [old, replacement] = await futureChange();
    expect(await remove(replacement)).toBe("deleted");
    expect(await task(old)).toMatchObject({ cutoff: addDays(today, 5), replaced_by: null });
  });

  it("only touches the caller's own tasks", async () => {
    const [old, replacement] = await futureChange();
    await db.exec(`set local request.jwt.claim.sub = '${OTHER}'; savepoint s;`);
    await expect(remove(old)).rejects.toThrow("Task not found");
    await db.exec(`rollback to savepoint s; set local request.jwt.claim.sub = '${OWNER}';`);
    expect(await task(replacement)).not.toBeNull();
    await db.exec("savepoint a; set local role anon;");
    await expect(remove(old)).rejects.toThrow(/permission denied/);
    await db.exec("rollback to savepoint a;");
  });
});

describe("rescheduling the old version again", () => {
  it("before the cutoff: replaces both it and the pending replacement, one schedule at a time", async () => {
    const [old, replacement] = await futureChange();
    // Saturdays and Mondays from today
    const latest = await change(old, today, true, "ورزش", [0, 2]);
    expect(await task(replacement)).toBeNull();
    expect(await task(old)).toMatchObject({ cutoff: today, replaced_by: latest });
    // weekdays aside, no day has two versions of the task
    for (const day of [today, addDays(today, 5), addDays(today, 30)]) expect(await activeOn(day)).toEqual([latest]);
  });

  it("on the cutoff: changes the replacement, the version in effect then", async () => {
    const [old, replacement] = await futureChange();
    expect(await change(old, addDays(today, 5), true)).toBe(replacement);
    expect(await task(old)).toMatchObject({ cutoff: addDays(today, 5), replaced_by: replacement });
    expect(await task(replacement)).toMatchObject({ date: addDays(today, 5), recurring: true, cutoff: null });
  });

  it("after the cutoff: reschedules the replacement from that day", async () => {
    const [old, replacement] = await futureChange();
    const latest = await change(old, addDays(today, 8), true);
    expect(latest).not.toBe(replacement);
    expect(await task(replacement)).toMatchObject({ cutoff: addDays(today, 8), replaced_by: latest });
    expect(await activeOn(addDays(today, 5))).toEqual([replacement]);
    expect(await activeOn(addDays(today, 8))).toEqual([latest]);
  });

  it("renaming from today on renames the pending replacement too", async () => {
    const [old, replacement] = await futureChange();
    await db.query("update public.tasks set is_recurring = true where id = $1", [replacement]);
    expect(await change(old, today, true, "باشگاه")).toBe(old);
    expect((await task(old))?.title).toBe("باشگاه");
    expect((await task(replacement))?.title).toBe("باشگاه");
  });

  it("an ended version still can't be rescheduled", async () => {
    const old = await insertTask(addDays(today, -10));
    await db.query("update public.tasks set archived_at = now() - interval '2 days' where id = $1", [old]);
    await db.exec("savepoint s");
    await expect(change(old, today)).rejects.toThrow("Task schedule already ended");
    await db.exec("rollback to savepoint s");
  });
});

describe("the migration", () => {
  it("links existing future cutoffs to their replacement when the match is unique", async () => {
    const before = await dbUpTo(NEW_MIGRATION);
    try {
      const day = (offset: number) => addDays(today, offset);
      await before.query(
        `insert into public.tasks (id, user_id, title, is_recurring, date, created_at, archived_at) values
          ('11111111-1111-1111-1111-111111111111', $1, 'a', true, $2, now() - interval '1 day', ($3::date::timestamp at time zone 'Asia/Tehran')),
          ('22222222-2222-2222-2222-222222222222', $1, 'a', false, $3, now(), null),
          ('33333333-3333-3333-3333-333333333333', $1, 'b', true, $2, now() - interval '1 day', ($4::date::timestamp at time zone 'Asia/Tehran')),
          ('44444444-4444-4444-4444-444444444444', $1, 'b', false, $4, now(), null),
          ('55555555-5555-5555-5555-555555555555', $1, 'c', false, $4, now(), null)`,
        [OWNER, day(-5), day(4), day(6)],
      );
      await before.exec(readFileSync(supabaseDir + "migrations/" + NEW_MIGRATION, "utf8"));
      const links = (await before.query<{ id: string; replaced_by: string | null }>(
        "select id, replaced_by from public.tasks where archived_at is not null order by id",
      )).rows;
      expect(links).toEqual([
        { id: "11111111-1111-1111-1111-111111111111", replaced_by: "22222222-2222-2222-2222-222222222222" },
        // two tasks start on that day: ambiguous, left unlinked
        { id: "33333333-3333-3333-3333-333333333333", replaced_by: null },
      ]);
    } finally {
      await before.close();
    }
  });
});
