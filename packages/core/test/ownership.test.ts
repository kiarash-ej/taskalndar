import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const taskId = '11111111-1111-1111-1111-111111111111';
const goalId = '22222222-2222-2222-2222-222222222222';
let db: PGlite;

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
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
    insert into auth.users values ('${owner}'), ('${other}');
  `);
  const directory = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));
  for (const file of readdirSync(directory).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(directory + file, 'utf8'));
  }
  await db.exec(`
    insert into public.tasks (id, user_id, title) values ('${taskId}', '${owner}', 'task');
    insert into public.goals (id, user_id, title, target_value, unit)
      values ('${goalId}', '${owner}', 'goal', 30, 'km');
  `);
}, 20_000);

afterAll(async () => { await db?.close(); });

async function asUser(userId: string, operation: () => Promise<void>) {
  await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub = '${userId}';`);
  try { await operation(); } finally { await db.exec('rollback'); }
}

describe('parent ownership', () => {
  it('allows the owner to write and update completions and goal logs', async () => {
    await asUser(owner, async () => {
      await db.exec(`
        insert into public.task_completions (task_id, user_id, date)
          values ('${taskId}', '${owner}', '2026-10-01');
        insert into public.task_completions (task_id, user_id, date, done)
          values ('${taskId}', '${owner}', '2026-10-01', false)
          on conflict (task_id, date) do update set done = excluded.done;
        insert into public.goal_logs (goal_id, user_id, date, amount)
          values ('${goalId}', '${owner}', '2026-10-01', 3);
      `);
      expect((await db.query('select done from public.task_completions')).rows).toEqual([{ done: false }]);
      expect((await db.query('select amount from public.goal_logs')).rows).toEqual([{ amount: '3' }]);
    });
  });

  it.each([
    ['task_completions', 'task_id', taskId, ''],
    ['goal_logs', 'goal_id', goalId, ', amount'],
  ])('rejects cross-owner inserts into %s', async (table, column, id, amountColumn) => {
    await asUser(other, async () => {
      expect((await db.query(`select id from public.${table === 'goal_logs' ? 'goals' : 'tasks'}`)).rows).toEqual([]);
      await expect(db.exec(`
        insert into public.${table} (${column}, user_id, date${amountColumn})
          values ('${id}', '${other}', '2026-10-01'${amountColumn ? ', 1' : ''});
      `)).rejects.toThrow(/foreign key/);
    });
  });

  it('rejects moving an owned completion onto another user’s task', async () => {
    await db.exec(`insert into public.tasks (id, user_id, title)
      values ('33333333-3333-3333-3333-333333333333', '${other}', 'other task');`);
    await asUser(other, async () => {
      await db.exec(`insert into public.task_completions (task_id, user_id, date)
        values ('33333333-3333-3333-3333-333333333333', '${other}', '2026-10-01');`);
      await expect(db.exec(`update public.task_completions set task_id = '${taskId}'`)).rejects.toThrow(/foreign key/);
    });
  });
});
