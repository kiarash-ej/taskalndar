-- The slice of the Supabase platform our migrations rely on (auth, API roles,
-- Storage), for running them on PGlite in tests. Supabase provides the real
-- ones; never apply this file to a project.

create schema auth;
create table auth.users (id uuid primary key);
-- Like Supabase's: the signed-in user from the request's JWT, if any.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create role authenticated;
create role anon;
create role service_role bypassrls;
grant usage on schema public, auth to authenticated, anon, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, anon, service_role;

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

grant usage on schema storage to authenticated, anon, service_role;
grant select, insert, update, delete on storage.objects to authenticated, anon, service_role;
grant select on storage.buckets to authenticated, anon, service_role;
