-- Day of the Iranian week: 0 = Saturday .. 6 = Friday (same numbering as
-- jalaaliWeekday in packages/core). extract(dow) is 0 = Sunday .. 6 = Saturday.
create function public.jalali_weekday(d date) returns smallint
language sql
immutable
set search_path = ''
as $$
  select ((extract(dow from d)::int + 1) % 7)::smallint
$$;

-- The one stored form of a weekday set: 1 to 6 distinct days in 0..6, sorted.
-- All 7 days is stored as null ("every day"), so equal schedules compare equal.
create function public.weekdays_are_canonical(w smallint[]) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    cardinality(w) between 1 and 6
      and 0 <= all(w) and 6 >= all(w)
      and w = (select array_agg(d order by d) from (select distinct d from unnest(w) d) days),
    false)
$$;

-- A recurring task with weekdays repeats from `date` on only on those days of
-- the week; null keeps the existing meaning (every day). One-time tasks have none.
alter table public.tasks add column weekdays smallint[];
alter table public.tasks add constraint tasks_weekdays_check check (
  weekdays is null or (is_recurring and public.weekdays_are_canonical(weekdays))
);

-- spec v1 only had monthly goals; weekly targets cover one Jalali week (Sat..Fri).
alter table public.goals add constraint goals_period_check check (period in ('monthly', 'weekly'));

-- update_task_schedule gains the weekday set as a fifth, optional argument, so
-- the app's existing 4-argument calls keep meaning "every day". The old
-- signature is dropped rather than overloaded: a 4-argument call would be
-- ambiguous between the two.
drop function public.update_task_schedule(uuid, text, boolean, date);

create function public.update_task_schedule(
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

  if old_task.is_recurring = p_is_recurring and old_task.weekdays is not distinct from v_weekdays then
    update public.tasks set title = trim(p_title) where id = p_task_id;
    return p_task_id;
  end if;
  if old_task.archived_at is not null then raise exception 'Task schedule already ended'; end if;

  effective_date := greatest(p_effective_date, old_task.date, (now() at time zone 'Asia/Tehran')::date);
  if old_task.date >= effective_date then
    update public.tasks set title = trim(p_title), is_recurring = p_is_recurring,
      weekdays = v_weekdays, date = effective_date where id = p_task_id;
    return p_task_id;
  end if;

  update public.tasks set archived_at = (effective_date::timestamp at time zone 'Asia/Tehran')
    where id = p_task_id;
  insert into public.tasks (user_id, title, is_recurring, weekdays, date)
    values (auth.uid(), trim(p_title), p_is_recurring, v_weekdays, effective_date) returning id into new_id;
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
revoke all on function public.update_task_schedule(uuid, text, boolean, date, smallint[]) from public, anon;
grant execute on function public.update_task_schedule(uuid, text, boolean, date, smallint[]) to authenticated;
