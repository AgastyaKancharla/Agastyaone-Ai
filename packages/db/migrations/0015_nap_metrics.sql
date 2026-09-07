-- =============================================================================
-- 0015_nap_metrics
--
-- Snapshots the four NAP metrics when an audit completes.
--
-- WHY A TRIGGER AND NOT A NIGHTLY CRON JOB
--
-- The original plan said "metrics via a nightly pg_cron job". That is wrong for
-- this service and would have produced a chart that lies.
--
-- NAP audits are event-driven — they run on demand, not continuously. A nightly
-- job would copy the most recent audit's numbers into a fresh snapshot row
-- every night, so a client audited once in March would see thirty identical
-- points and reasonably read the flat line as "nothing is happening". Worse,
-- the day their score finally moves, the change is buried among duplicates.
--
-- One point per audit is the honest granularity: the value genuinely changed
-- then. pg_cron is installed here for work that IS time-based — uptime checks,
-- review polling — but it is not used for this.
-- =============================================================================

-- pg_cron needs shared_preload_libraries and superuser, which a CI container has
-- neither of. Nothing in this migration schedules a job — the extension is
-- installed here for later time-based work (uptime checks, review polling) — so
-- its absence must not block the trigger below, which is the actual payload.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%). Scheduled jobs will not run in this environment.', sqlerrm;
end $$;

create or replace function app.snapshot_nap_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (coalesce(new.completed_at, now()) at time zone 'Asia/Kolkata')::date;
  -- Directories where a listing was confidently attributed to this business.
  -- Excludes not_found (no listing) and ambiguous (found, but we will not
  -- claim it is theirs) — the same discipline the report applies.
  v_found integer := new.consistent_count + new.drift_count + new.inconsistent_count;
  -- What the client actually has to act on. Drift and inconsistency both need
  -- work; consistent does not.
  v_issues integer := new.drift_count + new.inconsistent_count;
begin
  insert into public.metric_snapshots
    (tenant_id, location_id, service_code, metric_code, definition_version,
     period_start, period_end, granularity, value)
  select
    new.tenant_id, new.location_id, 'directory_nap', m.code, 1,
    v_day, v_day, 'day', m.value
  from (values
    ('nap_consistency_score', new.audit_score),
    ('nap_coverage_pct',      new.coverage_pct),
    ('nap_issues_open',       v_issues::numeric),
    ('nap_listings_found',    v_found::numeric)
  ) as m(code, value)
  -- A null score means nothing could be confidently assessed. Recording it as
  -- zero would read as "your listings are terrible" rather than "we could not
  -- assess them", so the point is simply absent.
  where m.value is not null
  on conflict (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
               metric_code, definition_version, granularity, period_start)
  -- Two audits on the same day for the same location: the later one wins.
  do update set value = excluded.value, computed_at = now();

  return new;
end;
$$;

-- Fires only on the transition INTO completed, so re-saving a completed audit
-- does not rewrite history.
create trigger nap_audits_snapshot_metrics
  after update of status on nap_audits
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function app.snapshot_nap_metrics();
