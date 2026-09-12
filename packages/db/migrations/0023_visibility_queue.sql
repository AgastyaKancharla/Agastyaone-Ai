-- =============================================================================
-- 0023_visibility_queue
--
-- Job queue for visibility audits, on pgmq, alongside the existing nap_audits
-- queue. A separate queue rather than a job-type column on one queue: the two
-- run at different cadences and will eventually want different visibility
-- timeouts (a map-grid scan runs far longer than a page fetch), and a stuck
-- visibility job must never block a NAP audit behind it.
-- =============================================================================

select pgmq.create('visibility_audits');

-- -----------------------------------------------------------------------------
-- Enqueue, callable from the Console by an authenticated staff user.
--
-- Unlike enqueue_nap_audit this does NOT refuse to run when there is no source
-- of truth. A visibility audit scores whatever it can reach and reports how
-- much of the model that covered; refusing outright would deny a clinic the
-- two pillars that need no website at all. Missing inputs lower coverage_pct,
-- they do not lower the score, and they never block the run.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_visibility_audit(p_location_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_website   text;
  v_audit_id  uuid;
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

  -- The NAP source of truth is the authoritative website when one is set --
  -- it is the address a human confirmed. Fall back to a site AgastyaOne built
  -- and has live, so a client on the Website service can be audited before any
  -- NAP work has been done for them.
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

  insert into public.visibility_audits (tenant_id, location_id, status, requested_by, website_url)
  values (v_tenant_id, p_location_id, 'queued', auth.uid(), v_website)
  returning id into v_audit_id;

  perform pgmq.send(
    'visibility_audits',
    jsonb_build_object(
      'audit_id',    v_audit_id,
      'tenant_id',   v_tenant_id,
      'location_id', p_location_id,
      'website_url', v_website
    )
  );

  return v_audit_id;
end;
$$;

revoke execute on function public.enqueue_visibility_audit(uuid) from public, anon;
grant  execute on function public.enqueue_visibility_audit(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Worker-side wrappers. Same reasoning as 0014: pgmq is not exposed to
-- PostgREST and must not be, so the service role gets thin wrappers in public
-- and nothing signed in as a user can touch the queue at all.
-- -----------------------------------------------------------------------------
create or replace function public.visibility_queue_read(p_vt integer default 300, p_qty integer default 1)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
volatile
security definer
set search_path = ''
as $$
  select q.msg_id, q.read_ct, q.enqueued_at, q.message
  from pgmq.read('visibility_audits', p_vt, p_qty) q;
$$;

create or replace function public.visibility_queue_delete(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.delete('visibility_audits', p_msg_id);
$$;

create or replace function public.visibility_queue_archive(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.archive('visibility_audits', p_msg_id);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.visibility_queue_read(integer,integer)',
    'public.visibility_queue_delete(bigint)',
    'public.visibility_queue_archive(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant  execute on function %s to service_role', f);
  end loop;
end $$;
