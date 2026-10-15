-- enforce_parent_ownership turns the child -> parent FKs into composite
-- (task_id, user_id) and (goal_id, user_id) references. The
-- unindexed_foreign_keys lint (0001) only counts an index whose leading
-- columns equal the FK's columns in order, so neither the unique
-- (task_id, date) index nor goal_logs_goal_idx (goal_id) covers them.
-- These also serve the parent-delete cascades and per-goal lookups, which
-- makes goal_logs_goal_idx redundant once they exist.
create index task_completions_task_user_idx on public.task_completions (task_id, user_id);
create index goal_logs_goal_user_idx on public.goal_logs (goal_id, user_id);
