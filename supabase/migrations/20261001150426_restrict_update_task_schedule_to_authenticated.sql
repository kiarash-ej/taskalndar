-- preserve_task_and_goal_history revoked execute from PUBLIC, but Supabase's
-- default privileges grant EXECUTE on new public functions to anon directly,
-- so anon kept it. The function already rejects calls without auth.uid();
-- this makes the grant match that intent.
revoke execute on function public.update_task_schedule(uuid, text, boolean, date) from anon;
