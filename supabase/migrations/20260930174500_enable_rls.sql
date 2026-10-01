alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.goals enable row level security;
alter table public.goal_logs enable row level security;

create policy "tasks_owner_all" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "task_completions_owner_all" on public.task_completions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "goals_owner_all" on public.goals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "goal_logs_owner_all" on public.goal_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
