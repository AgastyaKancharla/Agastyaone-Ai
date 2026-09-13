-- =============================================================================
-- 0034_contract_reference
--
-- contracts.reference is nullable by design (0003): a draft that never gets
-- sent does not deserve a permanent, gapless number burned against it. This
-- assigns one automatically the first time a contract leaves 'draft' -- the
-- same "concurrent callers serialise" guarantee app.next_reference already
-- provides, now actually wired to something that calls it.
--
-- A trigger rather than application code choosing the moment: the number
-- must be assigned exactly once, at a single well-defined transition, and a
-- trigger cannot be skipped by a caller that goes through a different code
-- path later (a bulk status update, a future integration, a fixed-up import).
-- =============================================================================

create or replace function app.assign_contract_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agastyaone_id uuid;
begin
  if old.status = 'draft' and new.status <> 'draft' and new.reference is null then
    select id into v_agastyaone_id from public.tenants where is_internal limit 1;
    new.reference := app.next_reference(v_agastyaone_id, 'contract', current_date);
  end if;
  return new;
end;
$$;

-- Runs before contracts_entitlements (0003): the reference belongs on the
-- row before anything else reacts to its status changing.
create trigger contracts_assign_reference
  before update of status on contracts
  for each row execute function app.assign_contract_reference();
