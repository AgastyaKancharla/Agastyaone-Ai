-- =============================================================================
-- 0001_foundation
-- Extensions, the private `app` schema, and the helper functions every RLS
-- policy depends on.
--
-- `app` is deliberately NOT in PostgREST's exposed schema list, so nothing in
-- here is reachable over the API.
-- =============================================================================

-- Helper bodies reference tables created in later migrations. `language sql`
-- functions are validated at CREATE time (plpgsql defers), so body checking is
-- disabled for this migration -- the same thing pg_dump does when restoring.
set check_function_bodies = off;

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;
grant usage on schema app to authenticated, service_role;

create extension if not exists pg_trgm       with schema extensions;
create extension if not exists fuzzystrmatch with schema extensions;
create extension if not exists btree_gist    with schema extensions;
create extension if not exists citext        with schema extensions;

-- -----------------------------------------------------------------------------
-- Conventions
-- -----------------------------------------------------------------------------
-- * Status vocabularies are `text` + CHECK, never Postgres enum: enum values
--   cannot be dropped or reordered, and a schema designed before the UI exists
--   will get roughly a third of its vocabularies wrong.
-- * Money is numeric(14,2). Never float.
-- * Every tenant-scoped table carries tenant_id; every runtime table also
--   carries location_id.
-- -----------------------------------------------------------------------------

create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Access helpers.
--
-- All of these are STABLE (a VOLATILE function in a policy is re-executed once
-- per row) and SECURITY DEFINER (so reading `memberships` from inside a policy
-- on `memberships` does not recurse). search_path is pinned empty and every
-- reference is schema-qualified, which is mandatory on SECURITY DEFINER.
--
-- Access is derived from tables rather than JWT claims. Claims are faster, but
-- a failed or stale token hook would then become a security hole rather than a
-- performance regression. Policies call these once per query via InitPlan, so
-- the table reads are amortised.
-- -----------------------------------------------------------------------------

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.profile_id = (select auth.uid())
      and s.status = 'active'
  );
$$;

create or replace function app.current_staff_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.staff_members s
  where s.profile_id = (select auth.uid())
    and s.status = 'active';
$$;

-- The workhorse. Returns every tenant the caller may see.
--
-- Policies MUST use this as `tenant_id = any ((select app.accessible_tenant_ids()))`
-- rather than passing the row in as an argument: a function taking the row
-- cannot be hoisted by the planner and runs once per row instead of once per
-- query.
create or replace function app.accessible_tenant_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_scope  text;
  v_result uuid[];
begin
  if v_uid is null then
    return '{}'::uuid[];
  end if;

  select s.tenant_scope into v_scope
  from public.staff_members s
  where s.profile_id = v_uid and s.status = 'active';

  -- No staff row: a client user. Visibility comes from memberships.
  if v_scope is null then
    select coalesce(array_agg(m.tenant_id), '{}'::uuid[]) into v_result
    from public.memberships m
    where m.profile_id = v_uid and m.status = 'active';
    return v_result;
  end if;

  -- Staff. Role decides what you can do; scope decides which tenants you see.
  if v_scope = 'all' then
    select coalesce(array_agg(t.id), '{}'::uuid[]) into v_result
    from public.tenants t;
  elsif v_scope = 'assigned' then
    select coalesce(array_agg(aa.tenant_id), '{}'::uuid[]) into v_result
    from public.account_assignments aa
    join public.staff_members s on s.id = aa.staff_id
    where s.profile_id = v_uid and aa.status = 'active';
  else
    v_result := '{}'::uuid[];   -- 'none': task-level access only
  end if;

  return v_result;
end;
$$;

-- RBAC. Entitlement (what the org bought) is deliberately NOT checked here --
-- that is a product concern enforced at the route and write path, not a
-- security concern. Conflating them makes a lapsed subscription erase a
-- client's own historical data.
create or replace function app.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p       on p.id = rp.permission_id
    where ur.profile_id = (select auth.uid())
      and p.code = p_permission
  );
$$;

revoke execute on function app.is_staff()               from public, anon;
revoke execute on function app.current_staff_id()       from public, anon;
revoke execute on function app.accessible_tenant_ids()  from public, anon;
revoke execute on function app.has_permission(text)     from public, anon;
grant  execute on function app.is_staff()               to authenticated, service_role;
grant  execute on function app.current_staff_id()       to authenticated, service_role;
grant  execute on function app.accessible_tenant_ids()  to authenticated, service_role;
grant  execute on function app.has_permission(text)     to authenticated, service_role;
