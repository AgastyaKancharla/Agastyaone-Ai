-- =============================================================================
-- 0014_nap_queue_workers
--
-- pgmq lives in its own schema, which is not exposed to PostgREST — correctly,
-- since nothing signed in as a user should be able to read or delete queue
-- messages. The worker connects over PostgREST with the service role, so it
-- needs these thin wrappers in `public`.
--
-- All three are revoked from `authenticated` and `anon`. Only the service role
-- can call them, and the service role is confined by the ESLint boundary to
-- worker code and app/api/internal.
-- =============================================================================

/**
 * Claim up to `qty` jobs, hiding them from other workers for `vt` seconds.
 *
 * This is the whole reason for pgmq. The retired worker ran
 * `select ... where status='PENDING' limit 1` and then updated the row, with no
 * locking — so two workers claimed the same job — and no FAILED state, so a
 * throw left the job stuck in PROCESSING forever. Here a job that is not
 * deleted within the visibility timeout simply becomes visible again, and
 * `read_ct` counts how many times that has happened.
 */
create or replace function public.nap_queue_read(p_vt integer default 300, p_qty integer default 1)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
volatile
security definer
set search_path = ''
as $$
  select q.msg_id, q.read_ct, q.enqueued_at, q.message
  from pgmq.read('nap_audits', p_vt, p_qty) q;
$$;

/** Job done — remove it permanently. */
create or replace function public.nap_queue_delete(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.delete('nap_audits', p_msg_id);
$$;

/**
 * Dead-letter. Archiving keeps the message for inspection rather than dropping
 * it, which is what you want the morning after a directory changed its markup
 * and every job failed.
 */
create or replace function public.nap_queue_archive(p_msg_id bigint)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  select pgmq.archive('nap_audits', p_msg_id);
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.nap_queue_read(integer,integer)',
    'public.nap_queue_delete(bigint)',
    'public.nap_queue_archive(bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant  execute on function %s to service_role', f);
  end loop;
end $$;
