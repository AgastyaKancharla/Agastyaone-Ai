-- =============================================================================
-- 0017_tenant_access_log
--
-- Makes the access-logging claim true.
--
-- The design doc said: "An `all`-scope read outside your assignments writes an
-- audit_log row — one trigger." That was wrong twice over. Nothing wrote to
-- audit_log at all, and the mechanism described is impossible: **Postgres has
-- no SELECT trigger**. Reads cannot be logged by a trigger.
--
-- Logging has to happen where the read is issued. What is worth recording is
-- narrow: a staff member with `all` scope opening a client they are NOT
-- assigned to. That is privileged cross-account access. Logging every read by
-- the account manager who owns the relationship would be noise that buries the
-- one entry anyone would ever go looking for.
--
-- The decision lives in the function, not the caller, so the app cannot get the
-- condition wrong and every call site is a plain unconditional invocation.
-- =============================================================================

create or replace function public.log_tenant_access(
  p_tenant_id uuid,
  p_reason    text default 'console_view'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_staff_id uuid;
  v_scope    text;
  v_assigned boolean;
  -- text, not citext: search_path is pinned empty and citext lives in the
  -- extensions schema, so the unqualified type name does not resolve. It casts
  -- into the citext column on insert regardless.
  v_email    text;
begin
  select s.id, s.tenant_scope into v_staff_id, v_scope
  from public.staff_members s
  where s.profile_id = (select auth.uid()) and s.status = 'active';

  -- Not staff: clients reading their own data is not privileged access.
  if v_staff_id is null then
    return false;
  end if;

  -- Only 'all' scope can read outside an assignment in the first place.
  if v_scope is distinct from 'all' then
    return false;
  end if;

  select exists (
    select 1 from public.account_assignments aa
    where aa.tenant_id = p_tenant_id and aa.staff_id = v_staff_id and aa.status = 'active'
  ) into v_assigned;

  -- Reading an account you own is ordinary work, not something to log.
  if v_assigned then
    return false;
  end if;

  select p.email into v_email from public.profiles p where p.id = (select auth.uid());

  insert into public.audit_log (tenant_id, actor_id, actor_email, action, entity_type, entity_id, reason)
  values (p_tenant_id, (select auth.uid()), v_email,
          'tenant.access.unassigned', 'tenant', p_tenant_id, p_reason);

  return true;
end;
$$;

revoke execute on function public.log_tenant_access(uuid, text) from public, anon;
grant  execute on function public.log_tenant_access(uuid, text) to authenticated;

comment on function public.log_tenant_access(uuid, text) is
  'Records privileged cross-account access: an all-scope staff member opening a tenant they are not assigned to. No-ops for clients, for assigned staff, and for non-all scopes. Postgres has no SELECT trigger, so this is called from the read path.';
