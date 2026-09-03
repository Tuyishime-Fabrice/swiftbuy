-- ═══════════════════════════════════════════════════════════════════════════
--  LOCAL TEST SHIM — not part of the deployed schema
--
--  Supabase provides `auth` and `storage` for you. To run the migrations and
--  the RLS test-suite against a plain PostgreSQL instance in CI, this file
--  recreates just enough of them: the roles, auth.users, auth.uid(), and the
--  storage bucket/object tables the policies reference.
--
--  Never run this against a Supabase project.
-- ═══════════════════════════════════════════════════════════════════════════

do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

grant anon, authenticated, service_role to postgres;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Mirrors Supabase: the caller's identity comes from the request JWT claims,
-- which the test-suite sets with set_config('request.jwt.claims', ...).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub', ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', 'anon')
$$;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets(id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;
grant all on storage.objects, storage.buckets to authenticated, service_role;
