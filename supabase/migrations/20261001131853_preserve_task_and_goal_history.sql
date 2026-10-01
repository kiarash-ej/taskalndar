-- Keep the audit timestamp separate from the first day a goal can be scored.
-- Preserve backdated logs accepted by earlier app versions.
alter table public.goals add column start_date date;
update public.goals g set start_date = least(
  (g.created_at at time zone 'Asia/Tehran')::date,
  (select min(l.date) from public.goal_logs l where l.goal_id = g.id)
);
alter table public.goals alter column start_date set not null;
alter table public.goals alter column start_date set default ((now() at time zone 'Asia/Tehran')::date);

-- A recurrence change is a new schedule effective today or later. Locking and
-- versioning happen in one transaction, so failures cannot leave a task missing.
create function public.update_task_schedule(
  p_task_id uuid, p_title text, p_is_recurring boolean, p_effective_date date
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_task public.tasks%rowtype;
  effective_date date;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_title is null or length(trim(p_title)) = 0 or length(p_title) > 200
    or p_is_recurring is null or p_effective_date is null then
    raise exception 'Invalid task';
  end if;
  select * into old_task from public.tasks
    where id = p_task_id and user_id = auth.uid() for update;
  if not found then raise exception 'Task not found'; end if;

  if old_task.is_recurring = p_is_recurring then
    update public.tasks set title = trim(p_title) where id = p_task_id;
    return p_task_id;
  end if;
  if old_task.archived_at is not null then raise exception 'Task schedule already ended'; end if;

  effective_date := greatest(p_effective_date, old_task.date, (now() at time zone 'Asia/Tehran')::date);
  if old_task.date >= effective_date then
    update public.tasks set title = trim(p_title), is_recurring = p_is_recurring,
      date = effective_date where id = p_task_id;
    return p_task_id;
  end if;

  update public.tasks set archived_at = (effective_date::timestamp at time zone 'Asia/Tehran')
    where id = p_task_id;
  insert into public.tasks (user_id, title, is_recurring, date)
    values (auth.uid(), trim(p_title), p_is_recurring, effective_date) returning id into new_id;
  update public.task_completions set task_id = new_id
    where task_id = p_task_id and date >= effective_date
      and (p_is_recurring or date = effective_date);
  return new_id;
end;
$$;

revoke all on function public.update_task_schedule(uuid, text, boolean, date) from public;
grant execute on function public.update_task_schedule(uuid, text, boolean, date) to authenticated;
