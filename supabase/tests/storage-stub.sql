-- The slice of Supabase Storage that our migrations touch, for running them on
-- PGlite in tests. Supabase creates the real schema; never apply this file to
-- a project.
create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;

-- Same contract as Supabase's: the folder segments of an object path.
create function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated, anon;
grant select on storage.buckets to authenticated, anon;
