-- Sleep schedule: the user's bedtime and wake time for each night of the week,
-- turned automatically into "خواب" time blocks on the planner, plus a personal
-- link a phone automation calls when an alarm is set (src/app/api/sleep).
--
-- A night is named by the day its evening falls on, the way people say it
-- ("شنبه شب ساعت ۱ می‌خوابم" is the night starting Saturday evening, even
-- though 01:00 is already Sunday): a bedtime from 12:00 is on that day, one
-- before 12:00 is after its midnight, and the wake time is the first one after
-- the bedtime. Its blocks are cut at Tehran midnights like any other block.

-- How long a night with this bedtime and wake time is, in minutes (0 for equal times).
create function public.sleep_minutes(p_bedtime time, p_wake_time time) returns integer
language sql
immutable
set search_path = ''
as $$
  select ((extract(epoch from p_wake_time - p_bedtime)::int / 60) % 1440 + 1440) % 1440
$$;

-- When the night of p_night begins with this bedtime.
create function public.sleep_night_start(p_night date, p_bedtime time) returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_night + case when p_bedtime >= '12:00' then 0 else 1 end) + p_bedtime) at time zone 'Asia/Tehran'
$$;

-- One row per night of the week the user has a plan for; no row, no sleep block.
-- weekday is the night's evening day, 0 = Saturday .. 6 = Friday.
create table public.sleep_schedules (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  bedtime time not null check (bedtime < '24:00'),
  wake_time time not null check (wake_time < '24:00'),
  created_at timestamptz not null default now(),
  primary key (user_id, weekday),
  constraint sleep_schedules_length_check check (public.sleep_minutes(bedtime, wake_time) between 60 and 960)
);

alter table public.sleep_schedules enable row level security;
create policy "sleep_schedules_owner_all" on public.sleep_schedules
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Per-user bookkeeping. Blocks are created lazily, a night at most once:
-- filled_through is the last night already considered, so a sleep block the
-- user deletes stays deleted. Nights starting before applies_from (the last
-- schedule save) are never created, so saving doesn't rewrite the past.
-- hook_token_hash is the sha256 (hex) of the phone link's secret.
create table public.sleep_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  applies_from timestamptz,
  filled_through date,
  hook_token_hash text unique check (hook_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sleep_settings_set_updated_at before update on public.sleep_settings
  for each row execute function public.set_updated_at();

alter table public.sleep_settings enable row level security;
create policy "sleep_settings_owner_all" on public.sleep_settings
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sleep blocks are time blocks with source 'sleep' that remember their night.
alter table public.time_blocks drop constraint time_blocks_source_check;
alter table public.time_blocks add constraint time_blocks_source_check
  check (source in ('manual', 'timer', 'sleep'));
alter table public.time_blocks add column sleep_night date;
alter table public.time_blocks add constraint time_blocks_sleep_night_check
  check ((source = 'sleep') = (sleep_night is not null));
create index time_blocks_user_sleep_night_idx on public.time_blocks (user_id, sleep_night)
  where sleep_night is not null;

-- Replaces the night's sleep blocks with [p_bed_at, p_wake_at), one block per
-- Tehran day it touches. Authenticated callers only reach their own rows (RLS);
-- the phone link calls it with the service role for the link's owner.
create function public.set_sleep_night(p_user uuid, p_night date, p_bed_at timestamptz, p_wake_at timestamptz)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d date;
  last_day date;
begin
  if p_user is null or p_night is null or p_bed_at is null or p_wake_at is null
    or p_wake_at <= p_bed_at or p_wake_at - p_bed_at > interval '20 hours' then
    raise exception 'Invalid sleep';
  end if;
  if auth.uid() is not null and auth.uid() <> p_user then raise exception 'Not allowed'; end if;

  delete from public.time_blocks where user_id = p_user and sleep_night = p_night;

  d := (p_bed_at at time zone 'Asia/Tehran')::date;
  -- the day of the last moment asleep: waking at 00:00 adds nothing to that day
  last_day := ((p_wake_at - interval '1 microsecond') at time zone 'Asia/Tehran')::date;
  while d <= last_day loop
    insert into public.time_blocks (user_id, day, start_at, end_at, title, tags, source, sleep_night)
    values (
      p_user, d,
      greatest(p_bed_at, d::timestamp at time zone 'Asia/Tehran'),
      least(p_wake_at, (d + 1)::timestamp at time zone 'Asia/Tehran'),
      'خواب', '{خواب}', 'sleep', p_night
    );
    d := d + 1;
  end loop;
end;
$$;

-- Creates the caller's scheduled sleep blocks for every night not yet
-- considered, through p_until (but always at least two weeks ahead, so the
-- daily summary finds them, and at most 400 days ahead). The app calls it
-- before reading time blocks. Returns how many nights it created.
create function public.fill_sleep_blocks(p_until date)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tehran')::date;
  v_until date;
  v_state public.sleep_settings%rowtype;
  v_night date;
  v_plan public.sleep_schedules%rowtype;
  v_bed timestamptz;
  v_created integer := 0;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_until is null then raise exception 'Invalid day'; end if;
  v_until := least(greatest(p_until, v_today + 14), v_today + 400);

  -- the common case, nothing to do, takes no lock
  select * into v_state from public.sleep_settings where user_id = v_user;
  if not found or v_state.filled_through is null or v_state.filled_through >= v_until then return 0; end if;

  select * into v_state from public.sleep_settings where user_id = v_user for update;
  if v_state.filled_through >= v_until then return 0; end if;

  -- a long absence (or a hand-edited row) doesn't make this loop long
  for v_night in
    select n::date from generate_series(greatest(v_state.filled_through + 1, v_today - 60)::timestamp, v_until::timestamp, interval '1 day') n
  loop
    select * into v_plan from public.sleep_schedules
      where user_id = v_user and weekday = public.jalali_weekday(v_night);
    if not found then continue; end if;
    v_bed := public.sleep_night_start(v_night, v_plan.bedtime);
    if v_bed < v_state.applies_from then continue; end if;
    perform 1 from public.time_blocks where user_id = v_user and sleep_night = v_night;
    if found then continue; end if;
    perform public.set_sleep_night(v_user, v_night, v_bed,
      v_bed + make_interval(mins => public.sleep_minutes(v_plan.bedtime, v_plan.wake_time)));
    v_created := v_created + 1;
  end loop;

  update public.sleep_settings set filled_through = v_until where user_id = v_user;
  return v_created;
end;
$$;

-- Replaces the caller's weekly sleep schedule (empty arrays turn it off).
-- Nights that haven't started and whose blocks the user never touched are
-- removed and created again from the new schedule; started nights and edited
-- blocks stay as they are.
create function public.save_sleep_schedule(p_weekdays smallint[], p_bedtimes time[], p_wake_times time[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_weekdays is null or p_bedtimes is null or p_wake_times is null
    or coalesce(cardinality(p_weekdays), 0) <> coalesce(cardinality(p_bedtimes), 0)
    or coalesce(cardinality(p_weekdays), 0) <> coalesce(cardinality(p_wake_times), 0) then
    raise exception 'Invalid schedule';
  end if;

  insert into public.sleep_settings (user_id) values (v_user) on conflict (user_id) do nothing;
  perform 1 from public.sleep_settings where user_id = v_user for update;

  delete from public.sleep_schedules where user_id = v_user;
  insert into public.sleep_schedules (user_id, weekday, bedtime, wake_time)
    select v_user, w, b, k from unnest(p_weekdays, p_bedtimes, p_wake_times) as s(w, b, k);

  delete from public.time_blocks
  where user_id = v_user and sleep_night in (
    select sleep_night from public.time_blocks
    where user_id = v_user and sleep_night is not null
    group by sleep_night
    having min(start_at) > now() and bool_and(created_at = updated_at)
  );

  -- from yesterday's night on: it may not have started yet (bedtime after midnight)
  update public.sleep_settings
    set applies_from = now(), filled_through = (now() at time zone 'Asia/Tehran')::date - 2
    where user_id = v_user;
end;
$$;

-- Supabase grants anon execute directly, so revoking from public is not enough.
revoke all on function public.set_sleep_night(uuid, date, timestamptz, timestamptz) from public, anon;
grant execute on function public.set_sleep_night(uuid, date, timestamptz, timestamptz) to authenticated, service_role;
revoke all on function public.fill_sleep_blocks(date) from public, anon;
grant execute on function public.fill_sleep_blocks(date) to authenticated;
revoke all on function public.save_sleep_schedule(smallint[], time[], time[]) from public, anon;
grant execute on function public.save_sleep_schedule(smallint[], time[], time[]) to authenticated;
