-- =============================================================================
-- 0013_nap_queue
--
-- Job queue for NAP audits, on pgmq.
--
-- The retired worker polled `select ... where status='PENDING' limit 1` and then
-- updated the row. That has four defects, all of which bite in production and
-- none of which are visible in development with one worker:
--   * no row locking, so two workers claim the same job
--   * no FAILED state — a throw left the job stuck in PROCESSING forever
--   * no retry counter and no dead letter
--   * no tenant scoping
--
-- pgmq gives visibility timeouts, read counts and archiving natively, so none
-- of that has to be hand-rolled.
-- =============================================================================

-- Tolerant on purpose. On Supabase this installs the real extension; in CI the
-- bootstrap has already provided a working pgmq schema, where CREATE EXTENSION
-- would fail on the name clash. Failing here would block every later migration
-- over an environment difference rather than a defect.
do $$
begin
  create extension if not exists pgmq;
exception when others then
  raise notice 'pgmq extension not installed (%). Continuing — expected when a compatible pgmq schema already exists.', sqlerrm;
end $$;

select pgmq.create('nap_audits');

-- -----------------------------------------------------------------------------
-- Enqueue, callable from the Console by an authenticated staff user.
--
-- SECURITY DEFINER because pgmq's tables are not exposed to `authenticated` and
-- should not be — but the tenancy check is done explicitly against
-- app.accessible_tenant_ids() first, so this cannot be used to queue work
-- against someone else's location.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_nap_audit(p_location_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_sot_id    uuid;
  v_audit_id  uuid;
  v_dir_count integer;
begin
  if not app.is_staff() then
    raise exception 'Only staff can run audits' using errcode = '42501';
  end if;

  select l.tenant_id into v_tenant_id
  from public.tenant_locations l
  where l.id = p_location_id
    and l.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Location not found or not accessible' using errcode = '42501';
  end if;

  -- Audits pin the exact source-of-truth VERSION they ran against. Without
  -- this a relocation makes every historical audit unreadable, and the first
  -- client challenge ("you audited the wrong address") is unanswerable.
  select s.id into v_sot_id
  from public.nap_source_of_truth s
  where s.location_id = p_location_id and s.is_current;

  if v_sot_id is null then
    raise exception 'No NAP source of truth set for this location yet'
      using errcode = 'P0001';
  end if;

  select count(*) into v_dir_count from public.directories where is_enabled;

  insert into public.nap_audits (
    tenant_id, location_id, source_of_truth_id, status,
    requested_by, directories_requested
  )
  values (v_tenant_id, p_location_id, v_sot_id, 'queued', auth.uid(), v_dir_count)
  returning id into v_audit_id;

  perform pgmq.send(
    'nap_audits',
    jsonb_build_object(
      'audit_id',    v_audit_id,
      'tenant_id',   v_tenant_id,
      'location_id', p_location_id,
      'sot_id',      v_sot_id
    )
  );

  return v_audit_id;
end;
$$;

revoke execute on function public.enqueue_nap_audit(uuid) from public, anon;
grant  execute on function public.enqueue_nap_audit(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Set the source of truth for a location, SCD-2 style.
--
-- Closing the old version rather than updating it in place is what keeps every
-- past audit interpretable.
-- -----------------------------------------------------------------------------
create or replace function public.set_nap_source_of_truth(
  p_location_id  uuid,
  p_business_name text,
  p_address_line1 text default null,
  p_address_line2 text default null,
  p_locality      text default null,
  p_city          text default null,
  p_state         text default null,
  p_pincode       text default null,
  p_phone_raw     text default null,
  p_website       text default null,
  p_category      text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_version   integer;
  v_id        uuid;
begin
  if not app.is_staff() then
    raise exception 'Only staff can set the source of truth' using errcode = '42501';
  end if;

  select l.tenant_id into v_tenant_id
  from public.tenant_locations l
  where l.id = p_location_id
    and l.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Location not found or not accessible' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.nap_source_of_truth where location_id = p_location_id;

  update public.nap_source_of_truth
     set is_current = false, valid_to = now()
   where location_id = p_location_id and is_current;

  insert into public.nap_source_of_truth (
    tenant_id, location_id, version, business_name, address_line1, address_line2,
    locality, city, state, pincode, phone_raw, website, category,
    is_current, created_by
  )
  values (
    v_tenant_id, p_location_id, v_version, p_business_name, p_address_line1, p_address_line2,
    p_locality, p_city, p_state, p_pincode, p_phone_raw, p_website, p_category,
    true, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.set_nap_source_of_truth(uuid,text,text,text,text,text,text,text,text,text,text) from public, anon;
grant  execute on function public.set_nap_source_of_truth(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;
