-- goal_logs_goal_user_idx (goal_id, user_id) covers every lookup that
-- goal_logs_goal_idx (goal_id) served, so the single-column index only
-- costs writes.
drop index public.goal_logs_goal_idx;
