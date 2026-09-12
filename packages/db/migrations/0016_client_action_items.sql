-- =============================================================================
-- 0016_client_action_items
--
-- Lets a client mark their own action item done — and nothing else.
--
-- The table sits in the shared-RLS group, so clients can already SELECT their
-- tenant's rows while INSERT/UPDATE/DELETE require app.is_staff(). That is the
-- right default: a client should not be able to invent work items, reassign
-- them, change due dates, or edit the description of what was asked for.
--
-- But they do need to close them, and RLS cannot restrict WHICH COLUMNS an
-- UPDATE touches — that is column-level GRANT, which is per-role, not per-row,
-- so it cannot express "this client, on their own tenant's rows". A narrow
-- SECURITY DEFINER function is the honest way to express it: exactly one state
-- transition, nothing else reachable.
-- =============================================================================

create or replace function public.complete_client_action_item(p_item_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  -- accessible_tenant_ids() covers both sides: a client via membership, staff
  -- via scope or assignment. Either may close an item; neither may close one
  -- belonging to a tenant they cannot see.
  select a.tenant_id into v_tenant_id
  from public.client_action_items a
  where a.id = p_item_id
    and a.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Action item not found or not accessible' using errcode = '42501';
  end if;

  -- Only ever an open -> completed transition. Re-completing is a no-op rather
  -- than an error, so a double-click cannot move completed_at and distort the
  -- blocked_days figure this feeds.
  update public.client_action_items
     set status = 'completed', completed_at = now()
   where id = p_item_id
     and status in ('open', 'in_progress', 'blocked');

  return true;
end;
$$;

revoke execute on function public.complete_client_action_item(uuid) from public, anon;
grant  execute on function public.complete_client_action_item(uuid) to authenticated;
