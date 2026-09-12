-- =============================================================================
-- 0024_visibility_metrics
--
-- Snapshots the visibility metrics when an audit completes, on the same
-- event-driven principle as 0015: one point per audit, because that is when
-- the value genuinely changed. A nightly job would manufacture a flat line out
-- of a single March audit and bury the day it finally moved.
--
-- The website pillar is snapshotted alongside the composite. A composite that
-- moves is a question ("why?"); the pillar that moved is the answer, and
-- having both on one chart is the difference between a report and a diagnosis.
-- =============================================================================

create or replace function app.snapshot_visibility_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day     date := (coalesce(new.completed_at, now()) at time zone 'Asia/Kolkata')::date;
  v_website numeric(5,2);
  v_issues  integer;
begin
  -- Reads the children the worker wrote immediately before flipping status.
  select p.score into v_website
  from public.visibility_pillar_scores p
  where p.audit_id = new.id and p.pillar = 'website' and p.measured;

  select count(*) into v_issues
  from public.visibility_website_findings f
  where f.audit_id = new.id and f.kind = 'issue';

  insert into public.metric_snapshots
    (tenant_id, location_id, service_code, metric_code, definition_version,
     period_start, period_end, granularity, value)
  select
    new.tenant_id, new.location_id, 'visibility', m.code, 1,
    v_day, v_day, 'day', m.value
  from (values
    ('visibility_score',         new.composite_score),
    ('visibility_coverage_pct',  new.coverage_pct),
    ('visibility_website_score', v_website),
    ('visibility_issues_open',   v_issues::numeric)
  ) as m(code, value)
  -- Null means "could not assess", which is not the same fact as zero and must
  -- not be charted as one. The point is simply absent, exactly as in 0015.
  where m.value is not null
  on conflict (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
               metric_code, definition_version, granularity, period_start)
  do update set value = excluded.value, computed_at = now();

  return new;
end;
$$;

-- Only on the transition INTO completed, so re-saving a completed audit does
-- not rewrite history.
create trigger visibility_audits_snapshot_metrics
  after update of status on visibility_audits
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function app.snapshot_visibility_metrics();
