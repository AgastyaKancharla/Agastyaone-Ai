-- =============================================================================
-- 0027_map_rank_metrics
--
-- Snapshots map-rank metrics when a scan finishes, on the same event-driven
-- principle as 0015 and 0024: one point per scan, because that is when the
-- value genuinely changed.
--
-- THE COVERAGE GATE
--
-- Unlike the other two, this trigger can decline to write anything at all.
--
-- A grid scan is 81 separate lookups against a provider that can rate-limit,
-- and a scan that came back with 40 of 81 points knows very little -- but the
-- points it DID read may all look excellent, or all look terrible, purely by
-- where the blocking fell. Charting that would draw a cliff or a spike on the
-- client's trend line that never happened in the world.
--
-- So: below 80% coverage the scan is still stored, still visible in the
-- Console, still explains itself -- and contributes no point to the trend.
-- Missing evidence is not evidence of absence. This mirrors the same rule the
-- engine applies in metrics.ts (shouldSnapshot) rather than trusting the worker
-- to remember it.
-- =============================================================================

create or replace function app.snapshot_map_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (coalesce(new.completed_at, now()) at time zone 'Asia/Kolkata')::date;
begin
  if new.coverage_pct is null or new.coverage_pct < 80 then
    return new;
  end if;

  insert into public.metric_snapshots
    (tenant_id, location_id, service_code, metric_code, definition_version,
     period_start, period_end, granularity, value)
  select
    new.tenant_id, new.location_id, 'visibility', m.code, 1,
    v_day, v_day, 'day', m.value
  from (values
    ('map_rank_score', new.score),
    ('map_rank_solv',  new.solv),
    ('map_rank_arp',   new.arp)
  ) as m(code, value)
  -- ARP is null when the clinic was found nowhere. Absent, not zero: a zero
  -- would read as "ranked first everywhere", the exact opposite of the truth.
  where m.value is not null
  on conflict (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
               metric_code, definition_version, granularity, period_start)
  do update set value = excluded.value, computed_at = now();

  return new;
end;
$$;

-- Fires for 'partial' as well as 'completed': a partial scan that still cleared
-- 80% coverage is a legitimate measurement, and excluding it would throw away a
-- real data point for a cosmetic reason.
create trigger map_scans_snapshot_metrics
  after update of status on map_scans
  for each row
  when (new.status in ('completed','partial') and old.status is distinct from new.status)
  execute function app.snapshot_map_metrics();
