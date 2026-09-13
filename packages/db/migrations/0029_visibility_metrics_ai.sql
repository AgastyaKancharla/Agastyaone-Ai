-- =============================================================================
-- 0029_visibility_metrics_ai
--
-- Extends app.snapshot_visibility_metrics() (0024) to also trend the AI
-- answer-engine pillar, the moment it has a real value to trend.
--
-- WHY THIS IS AN EXTENSION AND NOT A NEW TRIGGER ON geo_runs
--
-- map_rank got its own dedicated trigger (0027) firing on map_scans, because
-- a scan is a rich, self-contained event with a single aggregate score at the
-- moment it finishes. geo_runs has no equivalent boundary: each row is one
-- (prompt, engine) check, and there can be dozens completing across a day
-- with no natural "this is the moment the number changed" instant among them.
-- Snapshotting per-row would draw a chart of noise, one point per API call,
-- which is exactly the failure 0015 was written to avoid in the other
-- direction (too FEW points). The one real boundary that already exists is a
-- visibility audit itself: whenever staff run one, the worker reads whatever
-- geo_runs data currently exists and computes a fresh ai_visibility pillar
-- score for it. That is the same honest, audit-triggered granularity
-- citations and reviews already use in visibility.ts's worker code.
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
  v_ai      numeric(5,2);
  v_issues  integer;
begin
  select p.score into v_website
  from public.visibility_pillar_scores p
  where p.audit_id = new.id and p.pillar = 'website' and p.measured;

  select p.score into v_ai
  from public.visibility_pillar_scores p
  where p.audit_id = new.id and p.pillar = 'ai_visibility' and p.measured;

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
    ('visibility_ai_score',      v_ai),
    ('visibility_issues_open',   v_issues::numeric)
  ) as m(code, value)
  -- Null means "could not assess" (no completed geo_runs yet, same as an
  -- unreached website), which is not the same fact as zero and must not be
  -- charted as one.
  where m.value is not null
  on conflict (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
               metric_code, definition_version, granularity, period_start)
  do update set value = excluded.value, computed_at = now();

  return new;
end;
$$;
