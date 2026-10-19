-- Reminders: a Bale/Telegram message some minutes before a time block starts.
-- Each user picks a default lead time; any block can override it or turn its
-- reminder off. Sent through the user's linked notification_channels (linked
-- is enough: `enabled` there is about the daily summary).

create table public.reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  -- how many minutes before a block starts, unless the block says otherwise
  lead_minutes smallint not null default 10 check (lead_minutes between 0 and 1440),
  -- remind at bedtime for the sleep schedule's blocks too
  include_sleep boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reminder_settings_set_updated_at before update on public.reminder_settings
  for each row execute function public.set_updated_at();

alter table public.reminder_settings enable row level security;
create policy "reminder_settings_owner_all" on public.reminder_settings
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- remind: false turns this block's reminder off. reminder_minutes: null uses
-- the user's lead_minutes. reminded_at: when the reminder went out, set by the sender.
alter table public.time_blocks
  add column remind boolean not null default true,
  add column reminder_minutes smallint check (reminder_minutes between 0 and 1440),
  add column reminded_at timestamptz;

-- what the sender scans: blocks still waiting for a reminder
create index time_blocks_pending_reminder_idx on public.time_blocks (start_at)
  where remind and reminded_at is null;

-- Moving a block or changing its reminder makes it due again.
create function public.reset_block_reminder() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.start_at is distinct from old.start_at
    or new.reminder_minutes is distinct from old.reminder_minutes
    or new.remind is distinct from old.remind then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

create trigger time_blocks_reset_reminder before update on public.time_blocks
  for each row execute function public.reset_block_reminder();

-- Marks the reminders due now as sent and returns them, so a second sender
-- running at the same time can't send them again. Due: the block starts
-- within its lead time, hasn't started more than 10 minutes ago (a sender
-- that was down doesn't send stale reminders), was planned before it began
-- (logging something already under way sends nothing), isn't done, and is
-- the first block of its night for sleep. Only users with a linked chat.
create function public.claim_due_reminders()
returns table (block_id uuid, user_id uuid, title text, start_at timestamptz, end_at timestamptz, is_sleep boolean)
language sql
security invoker
set search_path = ''
as $$
  with due as (
    select b.id
    from public.time_blocks b
    join public.reminder_settings s on s.user_id = b.user_id and s.enabled
    where b.remind and b.reminded_at is null and not b.done
      and b.start_at > now() - interval '10 minutes'
      and b.start_at <= now() + interval '1440 minutes'
      and b.start_at - make_interval(mins => coalesce(b.reminder_minutes, s.lead_minutes)) <= now()
      and b.created_at < b.start_at
      and (b.source <> 'sleep' or s.include_sleep)
      and not exists (
        select 1 from public.time_blocks p
        where p.user_id = b.user_id and p.sleep_night = b.sleep_night and p.start_at < b.start_at
      )
      and exists (
        select 1 from public.notification_channels c where c.user_id = b.user_id and c.chat_id is not null
      )
    for update of b skip locked
  )
  update public.time_blocks t set reminded_at = now()
  from due where t.id = due.id
  returning t.id, t.user_id, t.title, t.start_at, t.end_at, t.source = 'sleep'
$$;

revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;
