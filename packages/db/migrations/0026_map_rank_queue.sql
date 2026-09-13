-- =============================================================================
-- 0026_map_rank_queue
--
-- Third queue, alongside nap_audits and visibility_audits.
--
-- Separate rather than a job-type column on one queue because a grid scan is a
-- fundamentally different shape of work: 81 paced, cost-bearing calls over many
-- minutes, against a page fetch that takes seconds. Sharing a queue would put a
-- clinic's NAP audit behind somebody else's grid, and would force one
-- visibility timeout to serve both.
-- =============================================================================

select pgmq.create('map_scans');

-- -----------------------------------------------------------------------------
-- Queue one scan per ACTIVE keyword on a location.
--
-- Keywords are independent jobs on purpose: one keyword getting rate-limited
-- must not cost the others their results, and each retries on its own.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_map_scans(
  p_location_id uuid,
  p_grid_size   integer default 9,
  p_spacing_m   integer default 800
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_lat       numeric(9,6);
  v_lng       numeric(9,6);
  v_scan_id   uuid;
  v_count     integer := 0;
  r           record;
begin
  if not app.is_staff() then
    raise exception 'Only staff can run scans' using errcode = '42501';
  end if;

  if p_grid_size < 3 or p_grid_size % 2 = 0 then
    raise exception 'Grid size must be odd and at least 3' using errcode = 'P0001';
  end if;

  select l.tenant_id, l.latitude, l.longitude
    into v_tenant_id, v_lat, v_lng
  from public.tenant_locations l
  where l.id = p_location_id
    and l.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Location not found or not accessible' using errcode = '42501';
  end if;

  -- A grid without a centre is not a degraded scan, it is not a scan. Fail
  -- loudly here rather than queueing 81 lookups around latitude zero.
  if v_lat is null or v_lng is null then
    raise exception 'This location has no coordinates yet. Connect its Google place, or set them by hand, before scanning.'
      using errcode = 'P0001';
  end if;

  for r in
    select k.id, k.phrase
    from public.map_keywords k
    where k.location_id = p_location_id and k.is_active
    order by k.sort_order, k.phrase
  loop
    insert into public.map_scans (
      tenant_id, location_id, keyword, grid_size, spacing_m,
      center_lat, center_lng, status, requested_by, points_requested
    )
    values (
      v_tenant_id, p_location_id, r.phrase, p_grid_size, p_spacing_m,
      v_lat, v_lng, 'queued', auth.uid(), p_grid_size * p_grid_size
    )
    returning id into v_scan_id;

    perform pgmq.send(
      'map_scans',
      jsonb_build_object(
        'scan_id',     v_scan_id,
        'tenant_id',   v_tenant_id,
        'location_id', p_location_id,
        'keyword',     r.phrase
      )
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'No active keywords for this location. Add at least one before scanning.'
      using errcode = 'P0001';
  end if;

  return v_count;
end;
$$;

revoke execute on function public.enqueue_map_scans(uuid,integer,integer) from public, anon;
grant  execute on function public.enqueue_map_scans(uuid,integer,integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Worker-side wrappers. Same reasoning as 0014 and 0023.
--
-- The heartbeat is the one addition. CONFIG.visibilityTimeoutSec is 300s and a
-- paced 81-point scan runs well past that, so without extending the timeout
-- mid-run pgmq hands the same job to a second worker and the scan is billed
-- twice. The per-point upsert in map_scan_points is the second line of defence;
-- both exist because either alone has a gap.
-- -----------------------------------------------------------------------------
create or replace function public.map_queue_read(p_vt integer default 1800, p_qty integer default 1)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
volatile
security definer
set search_path = ''
as $$
  select q.msg_id, q.read_ct, q.enqueued_at, q.message
  from pgmq.read('map_scans', p_vt, p_qty) q;
$$;

create or replace function public.map_queue_heartbeat(p_msg_id bigint, p_vt integer default 1800)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform pgmq.set_vt('map_scans', p_msg_id, p_vt);
  return true;
end;
$$;

create or replace function public.map_queue_delete(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.delete('map_scans', p_msg_id);
$$;

create or replace function public.map_queue_archive(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.archive('map_scans', p_msg_id);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.map_queue_read(integer,integer)',
    'public.map_queue_heartbeat(bigint,integer)',
    'public.map_queue_delete(bigint)',
    'public.map_queue_archive(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant  execute on function %s to service_role', f);
  end loop;
end $$;
