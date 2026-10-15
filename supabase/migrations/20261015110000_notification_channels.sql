-- Where a user's daily planner summary is sent: a Bale or Telegram bot chat.
--
-- Linking: the app shows the row's link_code; the user sends "/start <code>"
-- to the bot, and the bot webhook (service role) stores the chat that sent it
-- through link_notification_channel. Users can never set chat_id themselves,
-- or anyone could have their summaries sent to someone else's chat.
create table public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bale', 'telegram')),
  -- 122 random bits; single use, cleared once linked
  link_code text unique default replace(gen_random_uuid()::text, '-', ''),
  link_code_expires_at timestamptz default now() + interval '30 minutes',
  chat_id text,
  linked_at timestamptz,
  enabled boolean not null default true,
  -- Tehran time; the sender runs every 15 minutes
  send_time time not null default '21:00'
    check (send_time < '24:00' and extract(minute from send_time)::int % 15 = 0 and extract(second from send_time) = 0),
  include_tasks boolean not null default true,
  include_blocks boolean not null default true,
  include_note boolean not null default true,
  -- the Tehran day the last summary went out; set by the sender only
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_channels_user_kind_key unique (user_id, kind),
  constraint notification_channels_link_check check ((chat_id is null) = (linked_at is null)),
  constraint notification_channels_code_check check (chat_id is null or link_code is null)
);

create index notification_channels_chat_idx on public.notification_channels (kind, chat_id);

create trigger notification_channels_set_updated_at before update on public.notification_channels
  for each row execute function public.set_updated_at();

alter table public.notification_channels enable row level security;
create policy "notification_channels_owner_all" on public.notification_channels
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- RLS limits rows; column privileges limit what users may write. A user
-- re-links by deleting the channel and creating it again (a fresh code).
revoke insert, update on public.notification_channels from authenticated, anon;
grant insert (user_id, kind, enabled, send_time, include_tasks, include_blocks, include_note)
  on public.notification_channels to authenticated;
grant update (enabled, send_time, include_tasks, include_blocks, include_note)
  on public.notification_channels to authenticated;

-- Called by the bot webhook for "/start <code>": links that chat if the code
-- is valid for this bot and unexpired. Returns whether a channel was linked.
create function public.link_notification_channel(p_kind text, p_code text, p_chat_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_chat_id is null or length(p_chat_id) = 0 then return false; end if;
  update public.notification_channels
    set chat_id = p_chat_id, linked_at = now(), link_code = null, link_code_expires_at = null
    where kind = p_kind and link_code = p_code and link_code_expires_at > now();
  return found;
end;
$$;

-- Called by the bot webhook for "/stop": removes every channel of that chat.
create function public.unlink_notification_chat(p_kind text, p_chat_id text)
returns integer
language sql
security invoker
set search_path = ''
as $$
  with removed as (
    delete from public.notification_channels where kind = p_kind and chat_id = p_chat_id returning 1
  )
  select count(*)::int from removed
$$;

revoke all on function public.link_notification_channel(text, text, text) from public, anon, authenticated;
grant execute on function public.link_notification_channel(text, text, text) to service_role;
revoke all on function public.unlink_notification_chat(text, text) from public, anon, authenticated;
grant execute on function public.unlink_notification_chat(text, text) to service_role;
