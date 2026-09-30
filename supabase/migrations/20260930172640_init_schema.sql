-- Tasks: daily checklist items defined by the user
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  is_recurring boolean not null default true,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Task completions: whether a task was done on a given date
create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  done boolean not null default true,
  unique (task_id, date)
);

-- Goals: numeric targets (v1: monthly period)
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_value numeric not null,
  unit text not null,
  period text not null default 'monthly',
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Goal logs: progress entries against a goal
create table public.goal_logs (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  amount numeric not null
);

create index task_completions_user_date_idx on public.task_completions (user_id, date);
create index goal_logs_user_date_idx on public.goal_logs (user_id, date);
create index tasks_user_idx on public.tasks (user_id);
create index goals_user_idx on public.goals (user_id);
