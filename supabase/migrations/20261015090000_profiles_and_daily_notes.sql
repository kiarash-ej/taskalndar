-- Keeps updated_at current on any row change, whatever the client sends.
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- One free-text note per user per calendar day (the user's day, chosen by the
-- app like task_completions.date).
create table public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  body text not null check (length(body) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create trigger daily_notes_set_updated_at before update on public.daily_notes
  for each row execute function public.set_updated_at();

alter table public.daily_notes enable row level security;
create policy "daily_notes_owner_all" on public.daily_notes
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Per-user settings, keyed by the auth user. The app creates the row on first
-- save, so a missing row reads as the defaults.
--
-- background_value by kind:
--   none      null
--   color     a #rrggbb hex color
--   gradient  the key of one of the app's built-in gradients
--   image     a path in the private `backgrounds` bucket, inside the user's own folder
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  background_kind text not null default 'none',
  background_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_background_check check (
    case background_kind
      when 'none' then background_value is null
      when 'color' then coalesce(background_value ~ '^#[0-9a-fA-F]{6}$', false)
      when 'gradient' then coalesce(background_value ~ '^[a-z0-9-]{1,40}$', false)
      when 'image' then coalesce(
        starts_with(background_value, id::text || '/')
          and length(background_value) <= 200
          and position('..' in background_value) = 0,
        false)
      else false
    end
  )
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
create policy "profiles_owner_all" on public.profiles
  for all
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
