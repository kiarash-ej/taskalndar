-- Fixes for the Supabase performance advisor.
--
-- auth_rls_initplan (lint 0003): a bare auth.uid() in a policy is re-evaluated
-- for every row. Wrapping it in (select auth.uid()) lets Postgres evaluate it
-- once per statement as an initPlan. Only the expressions change; each policy
-- keeps its name, command (all) and roles, and is never absent mid-migration.
alter policy "tasks_owner_all" on public.tasks
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "task_completions_owner_all" on public.task_completions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "goals_owner_all" on public.goals
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "goal_logs_owner_all" on public.goal_logs
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- unindexed_foreign_keys (lint 0001): goal_logs' FK to goals is composite
-- (goal_id, user_id), on delete cascade, but goal_id still leads it — an
-- index on goal_id alone speeds both that cascade lookup and per-goal
-- progress queries, without needing to repeat user_id.
create index goal_logs_goal_idx on public.goal_logs (goal_id);
