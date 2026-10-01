import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { scorePeriod, type ProgressData, type TaskRow } from "./scoring";

const owner = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const goalId = "22222222-2222-2222-2222-222222222222";
let db: PGlite;
let today: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role authenticated;
    create role anon;
    grant usage on schema public, auth to authenticated, anon;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
    insert into auth.users values ('${owner}'), ('${other}');
  `);
  const directory = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
  for (const file of readdirSync(directory).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(directory + file, 'utf8'));
    if (file.includes('init_schema')) {
      await db.exec(`
        insert into public.goals (id, user_id, title, target_value, unit, created_at)
          values ('${goalId}', '${owner}', 'goal', 30, 'km', '2026-10-01T08:00:00Z');
        insert into public.goal_logs (goal_id, user_id, date, amount) values
          ('${goalId}', '${owner}', '2026-09-21', 30),
          ('${goalId}', '${other}', '2026-01-01', 999);
      `);
    }
  }
  today = (await db.query<{ day: string }>("select (now() at time zone 'Asia/Tehran')::date::text as day")).rows[0].day;
}, 20_000);

afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub = '${owner}';`);
});
afterEach(async () => { await db.exec('rollback'); });

async function insertTask(recurring = true, date = addDays(today, -2)) {
  return (await db.query<{ id: string }>(
    "insert into public.tasks (user_id, title, is_recurring, date) values ($1, 'original', $2, $3) returning id",
    [owner, recurring, date],
  )).rows[0].id;
}

async function change(id: string, recurring: boolean, day = today, title = 'updated') {
  return (await db.query<{ id: string }>(
    "select public.update_task_schedule($1, $2, $3, $4) as id", [id, title, recurring, day],
  )).rows[0].id;
}

describe('history migrations', () => {
  it('removes cross-owner logs and backfills the goal start from legitimate logs', async () => {
    expect((await db.query('select start_date::text from public.goals')).rows).toEqual([{ start_date: '2026-09-21' }]);
    await db.exec('reset role');
    expect((await db.query('select user_id from public.goal_logs')).rows).toEqual([{ user_id: owner }]);
  });

  it('preserves earlier task scores and carries the effective day completion to the new schedule', async () => {
    const id = await insertTask();
    await db.query("insert into public.task_completions (task_id, user_id, date) values ($1, $2, $3), ($1, $2, $4)",
      [id, owner, addDays(today, -1), today]);
    const newId = await change(id, false);
    expect(newId).not.toBe(id);
    const tasks = (await db.query<TaskRow>('select id, title, is_recurring, date::text, archived_at::text from public.tasks')).rows;
    const completions = (await db.query<ProgressData['completions'][number]>('select task_id, date::text, done from public.task_completions')).rows;
    const data = { tasks, completions, goals: [], goalLogs: [] };
    expect(scorePeriod(data, addDays(today, -1), addDays(today, -1), today).taskPercent).toBe(100);
    expect(scorePeriod(data, today, today, today).expectedTasks).toBe(1);
    expect(scorePeriod(data, today, today, today).doneTasks).toBe(1);
    expect(completions).toContainEqual({ task_id: newId, date: today, done: true });
  });

  it('preserves a past one-time task when turning it into a daily task', async () => {
    const originalDate = addDays(today, -2);
    const id = await insertTask(false, originalDate);
    const newId = await change(id, true, originalDate);
    expect(newId).not.toBe(id);
    expect((await db.query('select date::text, is_recurring from public.tasks where id = $1', [id])).rows)
      .toEqual([{ date: originalDate, is_recurring: false }]);
    expect((await db.query('select date::text from public.tasks where id = $1', [newId])).rows)
      .toEqual([{ date: today }]);
  });

  it('applies future changes on the selected day and forbids backdated schedule changes', async () => {
    const id = await insertTask();
    const day = addDays(today, 5);
    const newId = await change(id, false, day);
    expect((await db.query("select (archived_at at time zone 'Asia/Tehran')::date::text as day from public.tasks where id = $1", [id])).rows)
      .toEqual([{ day }]);
    expect((await db.query('select date::text from public.tasks where id = $1', [newId])).rows).toEqual([{ date: day }]);
    const another = await insertTask();
    const replacement = await change(another, false, addDays(today, -1));
    expect((await db.query('select date::text from public.tasks where id = $1', [replacement])).rows).toEqual([{ date: today }]);
  });

  it('keeps task ids and dates when renaming or changing a task that starts today', async () => {
    const pastId = await insertTask();
    expect(await change(pastId, true)).toBe(pastId);
    expect((await db.query('select date::text from public.tasks where id = $1', [pastId])).rows)
      .toEqual([{ date: addDays(today, -2) }]);
    const id = await insertTask(true, today);
    expect(await change(id, false)).toBe(id);
  });

  it('rolls back the old schedule if inserting the replacement fails', async () => {
    const id = await insertTask();
    await db.exec(`reset role;
      create function public.reject_task_insert() returns trigger language plpgsql as $$ begin raise exception 'test insert failure'; end $$;
      create trigger reject_insert before insert on public.tasks for each row execute function public.reject_task_insert();
      set local role authenticated; savepoint before_change;`);
    await expect(change(id, false)).rejects.toThrow('test insert failure');
    await db.exec('rollback to savepoint before_change');
    expect((await db.query('select archived_at from public.tasks where id = $1', [id])).rows).toEqual([{ archived_at: null }]);
  });

  it('rejects a different owner and denies anonymous RPC execution', async () => {
    const id = await insertTask();
    await db.exec(`set local request.jwt.claim.sub = '${other}'; savepoint other_user;`);
    await expect(change(id, false)).rejects.toThrow('Task not found');
    await db.exec('rollback to savepoint other_user; set local role anon;');
    await expect(change(id, false)).rejects.toThrow(/permission denied/);
  });
});
