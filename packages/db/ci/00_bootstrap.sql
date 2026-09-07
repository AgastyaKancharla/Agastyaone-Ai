-- =============================================================================
-- CI BOOTSTRAP — NEVER APPLY THIS TO A REAL PROJECT
--
-- Recreates the pieces Supabase provides that a stock Postgres does not, so the
-- migrations and both test suites can run on a throwaway container with no
-- production credentials anywhere near CI.
--
-- Everything here is either provided by Supabase's platform (roles, the auth
-- schema, GoTrue's auth.uid()) or by an extension the stock image lacks. If you
-- find yourself wanting to add SCHEMA to this file, it belongs in a migration
-- instead — this file exists only to make the environment resemble Supabase.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles. Supabase creates these; the migrations grant to them by name.
-- service_role carries BYPASSRLS on the real platform, and the worker depends
-- on that, so CI must reproduce it or the worker's access model is untested.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'ci';
  end if;
end $$;

grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to current_user;

create schema if not exists extensions;
grant usage on schema extensions to public;

-- ---------------------------------------------------------------------------
-- auth: what GoTrue owns on the real platform.
-- Only the columns the migrations and the isolation suite actually touch.
-- ---------------------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key,
  instance_id         uuid,
  aud                 text,
  role                text,
  email               text,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Reads the same GUC PostgREST sets, so `set local request.jwt.claims` behaves
-- in CI exactly as it does against Supabase — which is what makes the isolation
-- suite meaningful here at all.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- pgmq: a minimal but REAL implementation, not a no-op.
--
-- The stock image has no pgmq. Stubbing send/read as no-ops would let the
-- migrations apply while quietly making the queue untestable, so this keeps the
-- semantics that matter — a visibility timeout and a read counter — because
-- those are exactly what the retired worker lacked.
--
-- Real queue behaviour is verified against the actual Supabase instance; this
-- exists so the migrations apply and the schema guards can run.
-- ---------------------------------------------------------------------------
create schema if not exists pgmq;

create table if not exists pgmq.messages (
  queue_name  text        not null,
  msg_id      bigserial   primary key,
  read_ct     integer     not null default 0,
  enqueued_at timestamptz not null default now(),
  vt          timestamptz not null default now(),
  message     jsonb
);
create table if not exists pgmq.archived (like pgmq.messages including all);

create or replace function pgmq.create(queue_name text)
returns void language sql as $$ select null::void $$;

create or replace function pgmq.send(queue_name text, msg jsonb)
returns bigint language sql as $$
  insert into pgmq.messages (queue_name, message) values (queue_name, msg) returning msg_id;
$$;

create or replace function pgmq.read(queue_name text, vt integer, qty integer)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, vt timestamptz, message jsonb)
language sql as $$
  update pgmq.messages m
     set vt = now() + make_interval(secs => vt), read_ct = m.read_ct + 1
   where m.msg_id in (
     select s.msg_id from pgmq.messages s
      where s.queue_name = read.queue_name and s.vt <= now()
      order by s.msg_id
      limit qty
      for update skip locked
   )
  returning m.msg_id, m.read_ct, m.enqueued_at, m.vt, m.message;
$$;

create or replace function pgmq.delete(queue_name text, msg_id bigint)
returns boolean language sql as $$
  with d as (delete from pgmq.messages m where m.msg_id = delete.msg_id returning 1)
  select exists (select 1 from d);
$$;

create or replace function pgmq.archive(queue_name text, msg_id bigint)
returns boolean language sql as $$
  with moved as (
    delete from pgmq.messages m where m.msg_id = archive.msg_id returning m.*
  ), ins as (
    insert into pgmq.archived select * from moved returning 1
  )
  select exists (select 1 from ins);
$$;
