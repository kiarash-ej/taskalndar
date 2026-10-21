-- Issue #4: a task rescheduled from a future day keeps its old version active
-- until that day (archived_at in the future) next to a replacement that starts
-- then. Deleting or rescheduling the old version again used to do nothing, or
-- fail with "Task schedule already ended". Each version now remembers its
-- replacement, and both operations follow it.
--
-- A version has *ended* once its cutoff (the Tehran day of archived_at) is
-- today or earlier; with a later cutoff it is still active, ending soon.

alter table public.tasks add column replaced_by uuid;
alter table public.tasks add constraint tasks_replaced_by_fkey foreign key (replaced_by, user_id)
  references public.tasks (id, user_id) on delete set null (replaced_by);
create index tasks_replaced_by_user_idx on public.tasks (replaced_by, user_id) where replaced_by is not null;

-- Link existing versions that end in the future to their replacement: the
-- same user's task starting on the cutoff day, created later. Only where that
-- match is unique; later versions never had a link to lose.
update public.tasks o set replaced_by = r.id
from public.tasks r
where o.archived_at is not null
  and (o.archived_at at time zone 'Asia/Tehran')::date > (now() at time zone 'Asia/Tehran')::date
  and r.user_id = o.user_id and r.id <> o.id
  and r.date = (o.archived_at at time zone 'Asia/Tehran')::date
  and r.created_at >= o.created_at
  and (select count(*) from public.tasks c
       where c.user_id = o.user_id and c.id <> o.id
         and c.date = (o.archived_at at time zone 'Asia/Tehran')::date and c.created_at >= o.created_at) = 1;

-- Removes a version that hasn't started (its date is after today) and every
-- replacement after it. They can't have completions: those are only recorded
-- up to today, so nothing is lost.
create function public.delete_future_task_chain(p_task_id uuid) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_next uuid;
  v_id uuid := p_task_id;
begin
  while v_id is not null loop
    select replaced_by into v_next from public.tasks
      where id = v_id and user_id = auth.uid() and date > v_today;
    if not found then exit; end if;
    delete from public.tasks where id = v_id;
    v_id := v_next;
  end loop;
end;
$$;

-- Deleting a task from the planner. Returns what happened:
--   'deleted'   it hadn't started: removed, with any future replacements
--   'archived'  it ends today, keeping its history; future replacements go too
--   'unchanged' an ended (historical) version: its cutoff stays where it was
create function public.delete_task(p_task_id uuid) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_today date := (now() at time zone 'Asia/Tehran')::date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_task from public.tasks where id = p_task_id and user_id = auth.uid() for update;
  if not found then raise exception 'Task not found'; end if;

  if v_task.archived_at is not null and (v_task.archived_at at time zone 'Asia/Tehran')::date <= v_today then
    return 'unchanged';
  end if;

  if v_task.date > v_today then
    perform public.delete_future_task_chain(p_task_id);
    return 'deleted';
  end if;

  perform public.delete_future_task_chain(v_task.replaced_by);
  update public.tasks set archived_at = now(), replaced_by = null where id = p_task_id;
  return 'archived';
end;
$$;

-- As before (20261015090200_weekly_schedules.sql), plus: a version that ends
-- in the future can be rescheduled again. Before its cutoff the new schedule
-- replaces it and its pending replacement; from the cutoff on, the change is
-- applied to the replacement, which is the version in effect then.
create or replace function public.update_task_schedule(
  p_task_id uuid, p_title text, p_is_recurring boolean, p_effective_date date,
  p_weekdays smallint[] default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_task public.tasks%rowtype;
  v_weekdays smallint[];
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_cutoff date;
  effective_date date;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_title is null or length(trim(p_title)) = 0 or length(p_title) > 200
    or p_is_recurring is null or p_effective_date is null then
    raise exception 'Invalid task';
  end if;

  -- Sort and dedupe the requested days; every day of the week means null.
  if p_weekdays is not null then
    if not p_is_recurring or cardinality(p_weekdays) = 0
      or not (0 <= all(p_weekdays) and 6 >= all(p_weekdays)) then
      raise exception 'Invalid task';
    end if;
    select array_agg(d order by d) into v_weekdays from (select distinct d from unnest(p_weekdays) d) days;
    if cardinality(v_weekdays) = 7 then v_weekdays := null; end if;
  end if;

  select * into old_task from public.tasks
    where id = p_task_id and user_id = auth.uid() for update;
  if not found then raise exception 'Task not found'; end if;
  v_cutoff := (old_task.archived_at at time zone 'Asia/Tehran')::date;

  effective_date := greatest(p_effective_date, old_task.date, v_today);

  -- From the cutoff on, this version no longer applies: change the one that does.
  if v_cutoff is not null and effective_date >= v_cutoff then
    if v_cutoff > v_today and old_task.replaced_by is not null then
      return public.update_task_schedule(old_task.replaced_by, p_title, p_is_recurring, effective_date, v_weekdays);
    end if;
    if old_task.is_recurring = p_is_recurring and old_task.weekdays is not distinct from v_weekdays then
      -- renaming an ended version only renames that version
      update public.tasks set title = trim(p_title) where id = p_task_id;
      return p_task_id;
    end if;
    raise exception 'Task schedule already ended';
  end if;

  if old_task.is_recurring = p_is_recurring and old_task.weekdays is not distinct from v_weekdays then
    -- a rename from today on carries over to the replacements still to come
    with recursive chain(id) as (
      select p_task_id
      union all
      select t.replaced_by from public.tasks t join chain on t.id = chain.id
      where t.replaced_by is not null and t.user_id = auth.uid()
    )
    update public.tasks set title = trim(p_title)
      where user_id = auth.uid() and id in (select id from chain) and (id = p_task_id or date > v_today);
    return p_task_id;
  end if;

  -- The new schedule supersedes any replacement still waiting to start.
  perform public.delete_future_task_chain(old_task.replaced_by);

  if old_task.date >= effective_date then
    update public.tasks set title = trim(p_title), is_recurring = p_is_recurring,
      weekdays = v_weekdays, date = effective_date, archived_at = null, replaced_by = null
      where id = p_task_id;
    return p_task_id;
  end if;

  insert into public.tasks (user_id, title, is_recurring, weekdays, date)
    values (auth.uid(), trim(p_title), p_is_recurring, v_weekdays, effective_date) returning id into new_id;
  update public.tasks set archived_at = (effective_date::timestamp at time zone 'Asia/Tehran'), replaced_by = new_id
    where id = p_task_id;
  -- Completions on days the new schedule covers move to it; the rest stay on
  -- the archived version, which no longer counts them.
  update public.task_completions set task_id = new_id
    where task_id = p_task_id and date >= effective_date
      and case when p_is_recurring
        then v_weekdays is null or public.jalali_weekday(date) = any(v_weekdays)
        else date = effective_date end;
  return new_id;
end;
$$;

-- Supabase grants anon execute directly, so revoking from public is not enough.
revoke all on function public.delete_future_task_chain(uuid) from public, anon;
grant execute on function public.delete_future_task_chain(uuid) to authenticated;
revoke all on function public.delete_task(uuid) from public, anon;
grant execute on function public.delete_task(uuid) to authenticated;
revoke all on function public.update_task_schedule(uuid, text, boolean, date, smallint[]) from public, anon;
grant execute on function public.update_task_schedule(uuid, text, boolean, date, smallint[]) to authenticated;
