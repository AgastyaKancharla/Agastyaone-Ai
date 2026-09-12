-- =============================================================================
-- Schema guards — run in CI on every change.
--
-- These are the invariants that are cheap to hold and expensive to lose. Each
-- query RAISES on violation so a non-zero exit fails the build.
-- =============================================================================

-- 1. Every table in public has RLS enabled AND forced.
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p')
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'Tables without RLS enabled+forced: %', v_bad;
  end if;
end $$;

-- 2. Every table has at least one policy, except the machine-only tables that
--    are deliberately unreachable by `authenticated` (service role only).
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join (select tablename, count(*) n from pg_policies where schemaname='public' group by 1) p
    on p.tablename = c.relname
  where n.nspname = 'public' and c.relkind in ('r','p')
    and p.n is null
    and c.relname not in ('audit_log','raw_events','webhook_events')
    and c.relname !~ '^raw_events_[0-9]{4}_[0-9]{2}$';
  if v_bad is not null then
    raise exception 'Tables with RLS but no policy: %', v_bad;
  end if;
end $$;

-- 3. Every view runs with security_invoker. A normal view executes with the
--    OWNER's rights and silently bypasses RLS on its base tables — the single
--    most likely leak vector once reporting views start appearing.
do $$
declare v_bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') <> 'true';
  if v_bad is not null then
    raise exception 'Views without security_invoker=on: %', v_bad;
  end if;
end $$;

-- 4. No SECURITY DEFINER function may have a mutable search_path.
do $$
declare v_bad text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ') into v_bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','app')
    and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%');
  if v_bad is not null then
    raise exception 'SECURITY DEFINER functions with mutable search_path: %', v_bad;
  end if;
end $$;

-- 5. Any table whose RLS policy FILTERS ON tenant_id must index tenant_id as
--    the LEADING column. A bare or trailing tenant_id is ~1% selective at 100
--    tenants, so the planner seq-scans straight through the security predicate
--    on every read.
--
--    Scoped to tables with a tenant_id-based policy on purpose: notifications
--    is scoped by profile_id and webhook_events is service-role only, so a
--    tenant_id index there would earn nothing and the guard should not demand
--    one.
do $$
declare v_bad text;
begin
  select string_agg(t.relname, ', ' order by t.relname) into v_bad
  from pg_class t
  join pg_namespace n on n.oid = t.relnamespace
  join pg_attribute a on a.attrelid = t.oid
    and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped
  where n.nspname = 'public' and t.relkind = 'r'
    and exists (
      select 1 from pg_policies pol
      where pol.schemaname = 'public' and pol.tablename = t.relname
        and coalesce(pol.qual,'') || coalesce(pol.with_check,'') like '%tenant_id%'
    )
    and not exists (
      select 1 from pg_index i
      where i.indrelid = t.oid
        and i.indkey[0] = a.attnum
    );
  if v_bad is not null then
    raise exception 'Tables filtering on tenant_id with no tenant_id-leading index: %', v_bad;
  end if;
end $$;

select 'schema guards: all invariants hold' as result;
