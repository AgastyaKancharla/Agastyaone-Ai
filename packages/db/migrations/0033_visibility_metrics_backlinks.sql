-- =============================================================================
-- 0033_visibility_metrics_backlinks
--
-- Extends app.snapshot_visibility_metrics() (0024, already extended once by
-- 0029 for ai_visibility) to also trend the backlinks pillar. Same reasoning
-- as 0029: a backlinks check has no rich per-row boundary of its own worth a
-- dedicated trigger -- one check is one number, and the honest event to
-- snapshot on is a visibility audit itself, once the worker has read whatever
-- backlinks_checks data currently exists and folded it into a fresh pillar
-- score. Same "read the latest, don't re-run" relationship every other pillar
-- already has with its own source table.
-- =============================================================================

create or replace function app.snapshot_visibility_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day        date := (coalesce(new.completed_at, now()) at time zone 'Asia/Kolkata')::date;
  v_website    numeric(5,2);
  v_ai         numeric(5,2);
  v_backlinks  numeric(5,2);
  v_issues     integer;
begin
  select p.score into v_website
  from public.visibility_pillar_scores p
  where p.audit_id = new.id and p.pillar = 'website' and p.measured;

  select p.score into v_ai
  from public.visibility_pillar_scores p
  where p.audit_id = new.id and p.pillar = 'ai_visibility' and p.measured;

  select p.score into v_backlinks
  from public.visibility_pillar_scores p
  where p.audit_id = new.id and p.pillar = 'backlinks' and p.measured;

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
    ('visibility_score',          new.composite_score),
    ('visibility_coverage_pct',   new.coverage_pct),
    ('visibility_website_score',  v_website),
    ('visibility_ai_score',       v_ai),
    ('visibility_backlinks_score',v_backlinks),
    ('visibility_issues_open',    v_issues::numeric)
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
