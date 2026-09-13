-- =============================================================================
-- 0032_backlinks_queue
--
-- Job queue for backlinks checks, on pgmq, alongside nap_audits,
-- visibility_audits, map_scans and geo_runs. Fifth queue, same reasoning as
-- every one before it: a stuck or slow job of one kind must never sit in
-- front of another.
-- =============================================================================

select pgmq.create('backlinks_checks');

-- -----------------------------------------------------------------------------
-- Enqueue, staff-only. Unlike enqueue_visibility_audit this DOES refuse when
-- there is no website: a backlinks check has nothing to check without one,
-- the same reasoning enqueue_map_scans refuses a location with no coordinates.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_backlinks_check(p_location_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_website   text;
  v_domain    text;
  v_check_id  uuid;
begin
  if not app.is_staff() then
    raise exception 'Only staff can run checks' using errcode = '42501';
  end if;

  select l.tenant_id into v_tenant_id
  from public.tenant_locations l
  where l.id = p_location_id
    and l.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Location not found or not accessible' using errcode = '42501';
  end if;

  -- Same resolution order as enqueue_visibility_audit: the NAP source of
  -- truth's website when one is set, falling back to a site AgastyaOne built
  -- and has live.
  select s.website into v_website
  from public.nap_source_of_truth s
  where s.location_id = p_location_id and s.is_current and s.website is not null;

  if v_website is null then
    select w.live_url into v_website
    from public.websites w
    where w.location_id = p_location_id and w.status = 'live' and w.live_url is not null
    order by w.updated_at desc
    limit 1;
  end if;

  if v_website is null then
    raise exception 'No website on file for this location. Add one before checking backlinks.'
      using errcode = 'P0001';
  end if;

  -- Strip to a bare host, one concern per step. website can be stored with or
  -- without a scheme (visibility.ts's own toNavigableUrl exists precisely
  -- because it is not guaranteed one), so scheme and www are stripped
  -- independently rather than by one regex that only catches www when a
  -- scheme is also present -- letting the same site normalise two different
  -- ways across two runs would mean the SAME domain checks as two different
  -- ones and its history would never line up.
  v_domain := lower(v_website);
  v_domain := regexp_replace(v_domain, '^[a-z]+://', '');
  v_domain := regexp_replace(v_domain, '^www\.', '');
  v_domain := regexp_replace(v_domain, '/.*$', '');
  v_domain := regexp_replace(v_domain, ':[0-9]+$', '');

  insert into public.backlinks_checks (tenant_id, location_id, domain, status, requested_by)
  values (v_tenant_id, p_location_id, v_domain, 'queued', auth.uid())
  returning id into v_check_id;

  perform pgmq.send(
    'backlinks_checks',
    jsonb_build_object(
      'check_id',    v_check_id,
      'tenant_id',   v_tenant_id,
      'location_id', p_location_id,
      'domain',      v_domain
    )
  );

  return v_check_id;
end;
$$;

revoke execute on function public.enqueue_backlinks_check(uuid) from public, anon;
grant  execute on function public.enqueue_backlinks_check(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Worker-side wrappers. pgmq is not exposed to PostgREST, so the service role
-- gets thin wrappers in public, same as every other queue.
-- -----------------------------------------------------------------------------
create or replace function public.backlinks_queue_read(p_vt integer default 120, p_qty integer default 1)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
volatile
security definer
set search_path = ''
as $$
  select q.msg_id, q.read_ct, q.enqueued_at, q.message
  from pgmq.read('backlinks_checks', p_vt, p_qty) q;
$$;

create or replace function public.backlinks_queue_delete(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.delete('backlinks_checks', p_msg_id);
$$;

create or replace function public.backlinks_queue_archive(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.archive('backlinks_checks', p_msg_id);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.backlinks_queue_read(integer,integer)',
    'public.backlinks_queue_delete(bigint)',
    'public.backlinks_queue_archive(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant  execute on function %s to service_role', f);
  end loop;
end $$;
