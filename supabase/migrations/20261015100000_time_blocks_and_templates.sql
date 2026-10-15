-- A tag list as stored: at most 10 distinct, trimmed, 1–40 character tags.
-- The app also folds Arabic ي/ك into Persian ی/ک before saving (src/lib/tags.ts),
-- so the same word is always one tag.
create function public.tags_are_canonical(t text[]) returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    cardinality(t) <= 10
      and array_position(t, null) is null
      and not exists (select 1 from unnest(t) tag where tag <> btrim(tag) or length(tag) not between 1 and 40)
      and cardinality(t) = (select count(distinct tag) from unnest(t) tag),
    false)
$$;

-- A stretch of one day ("16:00–18:00 study") with free-text details, tags,
-- and optionally how much was done and what it cost (toman). `day` is the
-- Tehran calendar day the block lies in; a block never crosses that day's
-- midnight (splitAtMidnights in packages/core cuts longer spans, e.g. timers).
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  tags text[] not null default '{}' check (public.tags_are_canonical(tags)),
  amount numeric check (amount >= 0),
  unit text check (unit is null or (amount is not null and length(btrim(unit)) between 1 and 30)),
  cost numeric check (cost >= 0),
  done boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'timer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_blocks_order_check check (end_at > start_at),
  constraint time_blocks_within_day_check check (
    (start_at at time zone 'Asia/Tehran')::date = day
    and end_at <= ((day + 1)::timestamp at time zone 'Asia/Tehran')
  )
);

create index time_blocks_user_day_idx on public.time_blocks (user_id, day);
create index time_blocks_tags_idx on public.time_blocks using gin (tags);

create trigger time_blocks_set_updated_at before update on public.time_blocks
  for each row execute function public.set_updated_at();

alter table public.time_blocks enable row level security;
create policy "time_blocks_owner_all" on public.time_blocks
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A named arrangement of blocks without dates, applied to any day.
create table public.day_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint day_templates_id_user_id_key unique (id, user_id)
);

create index day_templates_user_idx on public.day_templates (user_id);

create trigger day_templates_set_updated_at before update on public.day_templates
  for each row execute function public.set_updated_at();

alter table public.day_templates enable row level security;
create policy "day_templates_owner_all" on public.day_templates
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Times of day in Tehran; end_time may be 24:00 for "until midnight". The
-- composite FK keeps every block owned by its template's owner.
create table public.day_template_blocks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time time not null check (start_time < '24:00'),
  end_time time not null,
  title text not null check (length(btrim(title)) between 1 and 200),
  tags text[] not null default '{}' check (public.tags_are_canonical(tags)),
  constraint day_template_blocks_order_check check (end_time > start_time),
  constraint day_template_blocks_template_id_fkey foreign key (template_id, user_id)
    references public.day_templates (id, user_id) on delete cascade
);

create index day_template_blocks_template_user_idx on public.day_template_blocks (template_id, user_id);

alter table public.day_template_blocks enable row level security;
create policy "day_template_blocks_owner_all" on public.day_template_blocks
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Copies a template's blocks onto p_day as new time_blocks and returns them.
-- Applying twice adds the blocks twice; the app asks before re-applying.
create function public.apply_day_template(p_template_id uuid, p_day date)
returns setof public.time_blocks
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_day is null then raise exception 'Invalid day'; end if;
  perform 1 from public.day_templates where id = p_template_id and user_id = auth.uid();
  if not found then raise exception 'Template not found'; end if;

  return query
    insert into public.time_blocks (user_id, day, start_at, end_at, title, tags)
    select auth.uid(), p_day,
      (p_day + b.start_time) at time zone 'Asia/Tehran',
      (p_day + b.end_time) at time zone 'Asia/Tehran',
      b.title, b.tags
    from public.day_template_blocks b
    where b.template_id = p_template_id and b.user_id = auth.uid()
    order by b.start_time
    returning *;
end;
$$;

-- The caller's tags with how often each is used, for autocomplete.
create function public.user_tags()
returns table (tag text, uses bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select tag, count(*) as uses
  from public.time_blocks, unnest(tags) as tag
  where user_id = (select auth.uid())
  group by tag
  order by uses desc, tag
  limit 200
$$;

-- Supabase grants anon execute directly, so revoking from public is not enough.
revoke all on function public.apply_day_template(uuid, date) from public, anon;
grant execute on function public.apply_day_template(uuid, date) to authenticated;
revoke all on function public.user_tags() from public, anon;
grant execute on function public.user_tags() to authenticated;
