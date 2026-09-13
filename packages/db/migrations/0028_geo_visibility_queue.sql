-- =============================================================================
-- 0028_geo_visibility_queue
--
-- Job queue for AI-answer-engine checks, on geo_runs -- a table that has
-- existed unused since migration 0006. RLS, its policies and its
-- tenant-leading indexes were already established back then (geo_prompts,
-- geo_runs and geo_mentions are all in the 0009 shared_tables loop, and
-- geo_mentions got its tenant-leading index in 0011). This migration is
-- purely the missing plumbing: nothing writes to these tables yet, because
-- nothing has ever enqueued a check.
--
-- Fourth queue, alongside nap_audits, visibility_audits and map_scans. Kept
-- separate for the same reason as the others: an LLM call is a different
-- shape of work (seconds, not the minutes a grid scan takes) with its own
-- failure modes, and a stuck check here must not block a NAP audit behind it.
-- =============================================================================

select pgmq.create('geo_runs');

-- -----------------------------------------------------------------------------
-- Queue one job per active prompt, across a fixed set of answer engines.
--
-- Unlike enqueue_map_scans there is no per-run configuration to accept: which
-- engines actually respond for real is a worker-time decision (whichever API
-- keys are configured; the rest fall back to a fixture, exactly as an
-- unconfigured map-rank provider does), not something the Console needs to
-- choose per click.
-- -----------------------------------------------------------------------------
create or replace function public.enqueue_geo_runs(p_location_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_run_id    uuid;
  v_count     integer := 0;
  v_engine    text;
  r           record;
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

  for r in
    select p.id, p.prompt
    from public.geo_prompts p
    where p.location_id = p_location_id and p.is_active
    order by p.created_at
  loop
    -- The four answer engines a patient actually asks today. 'copilot' and
    -- 'other' stay valid values on the column for a future engine without a
    -- schema change, but nothing enqueues them yet.
    foreach v_engine in array array['chatgpt','perplexity','gemini','claude']
    loop
      insert into public.geo_runs (tenant_id, location_id, prompt_id, engine, status)
      values (v_tenant_id, p_location_id, r.id, v_engine, 'queued')
      returning id into v_run_id;

      perform pgmq.send(
        'geo_runs',
        jsonb_build_object(
          'run_id',      v_run_id,
          'tenant_id',   v_tenant_id,
          'location_id', p_location_id,
          'prompt',      r.prompt,
          'engine',      v_engine
        )
      );

      v_count := v_count + 1;
    end loop;
  end loop;

  if v_count = 0 then
    raise exception 'No active prompts for this location. Add at least one before checking.'
      using errcode = 'P0001';
  end if;

  return v_count;
end;
$$;

revoke execute on function public.enqueue_geo_runs(uuid) from public, anon;
grant  execute on function public.enqueue_geo_runs(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Worker-side wrappers. Same reasoning as every prior queue: pgmq is not
-- exposed to PostgREST, so the service role gets thin wrappers in public.
-- -----------------------------------------------------------------------------
create or replace function public.geo_queue_read(p_vt integer default 120, p_qty integer default 1)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
volatile
security definer
set search_path = ''
as $$
  select q.msg_id, q.read_ct, q.enqueued_at, q.message
  from pgmq.read('geo_runs', p_vt, p_qty) q;
$$;

create or replace function public.geo_queue_delete(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.delete('geo_runs', p_msg_id);
$$;

create or replace function public.geo_queue_archive(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.archive('geo_runs', p_msg_id);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.geo_queue_read(integer,integer)',
    'public.geo_queue_delete(bigint)',
    'public.geo_queue_archive(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant  execute on function %s to service_role', f);
  end loop;
end $$;
