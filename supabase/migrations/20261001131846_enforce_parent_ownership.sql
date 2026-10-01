-- Repair rows created under the old policy. These rows belonged to a different
-- user than their parent and must not occupy another user's completion slot.
delete from public.task_completions c
using public.tasks t
where c.task_id = t.id and c.user_id <> t.user_id;

delete from public.goal_logs l
using public.goals g
where l.goal_id = g.id and l.user_id <> g.user_id;

alter table public.tasks add constraint tasks_id_user_id_key unique (id, user_id);
alter table public.goals add constraint goals_id_user_id_key unique (id, user_id);

-- RLS checks the child's user_id; the composite FK now guarantees that the
-- parent belongs to that same user, including on UPDATE and direct REST calls.
alter table public.task_completions drop constraint task_completions_task_id_fkey;
alter table public.task_completions add constraint task_completions_task_id_fkey
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade;

alter table public.goal_logs drop constraint goal_logs_goal_id_fkey;
alter table public.goal_logs add constraint goal_logs_goal_id_fkey
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade;
