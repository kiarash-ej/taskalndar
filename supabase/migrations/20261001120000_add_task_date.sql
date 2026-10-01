-- spec.md: a task either repeats daily or is a one-time task "for a specific date",
-- but the initial schema had nowhere to store that date. `date` holds:
--   * one-time tasks (is_recurring = false): the single day the task is for
--   * recurring tasks (is_recurring = true): the first day the task repeats from
-- Like task_completions.date and goal_logs.date it is a calendar date (no time),
-- chosen by the app in the user's calendar rather than derived from created_at,
-- which is a UTC timestamp and can fall on a different day than the user's.
alter table public.tasks
  add column date date not null default current_date;

create index tasks_user_date_idx on public.tasks (user_id, date);
