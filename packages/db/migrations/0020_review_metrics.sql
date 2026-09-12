-- =============================================================================
-- 0020_review_metrics
--
-- Snapshots the review request funnel: how many codes went out, how many were
-- scanned, and the rate between them.
--
-- WHAT IS DELIBERATELY NOT MEASURED
--
-- There is no rating metric here. Google's rating and review text may be shown
-- live with attribution but not warehoused, and a metric_snapshots row IS a
-- warehouse — it exists precisely so the value can be read back months later.
-- Storing the rating daily would be the clearest possible breach of the terms
-- this service depends on. A rating trend arrives with owner-authorised GBP API
-- access, which carries no such restriction.
--
-- So the client sees a live rating with no history, and a funnel with history.
-- That split is honest about which numbers are ours to keep: the requests are
-- AgastyaOne's own record of work done, and the rating is Google's.
--
-- COHORT, NOT EVENT
--
-- A scan is counted on the day its code was ISSUED, not the day it was scanned.
-- "Of the codes handed out on Tuesday, 40% were scanned" is a funnel; counting
-- scans on the day they happen mixes cohorts and produces a rate that divides
-- one day's scans by a different day's codes. The consequence is that a past
-- day's numbers can still move when a late scan arrives, which is correct — the
-- alternative is a number that is wrong and stable.
--
-- On a trigger rather than pg_cron, for the same reason as 0015: this data is
-- event-driven, and a nightly job over it writes a flat line of duplicate
-- points that hides the day the number actually moved.
-- =============================================================================

create or replace function app.snapshot_review_metrics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day     date;
  v_issued  integer;
  v_clicked integer;
begin
  -- A request that has not been sent is not part of any cohort yet. A WhatsApp
  -- message sitting in 'pending' has been asked for, not delivered, and
  -- counting it as issued would report work that has not happened.
  if new.sent_at is null then
    return new;
  end if;

  v_day := (new.sent_at at time zone 'Asia/Kolkata')::date;

  select count(*),
         count(*) filter (where r.clicked_at is not null)
    into v_issued, v_clicked
  from public.review_requests r
  where r.tenant_id = new.tenant_id
    and r.location_id is not distinct from new.location_id
    and r.sent_at is not null
    and (r.sent_at at time zone 'Asia/Kolkata')::date = v_day;

  if v_issued = 0 then
    return new;
  end if;

  insert into public.metric_snapshots
    (tenant_id, location_id, service_code, metric_code, definition_version,
     period_start, period_end, granularity, value)
  select
    new.tenant_id, new.location_id, 'review_automation', m.code, 1,
    v_day, v_day, 'day', m.value
  from (values
    ('review_requests_issued',  v_issued::numeric),
    ('review_requests_clicked', v_clicked::numeric),
    ('review_click_rate',       round((v_clicked::numeric * 100) / v_issued, 2))
  ) as m(code, value)
  on conflict (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
               metric_code, definition_version, granularity, period_start)
  do update set value = excluded.value, computed_at = now();

  return new;
end;
$$;

-- Fires on the events that change either side of the ratio: a request being
-- sent, and a code being scanned. Not on every column, so unrelated edits do
-- not churn computed_at.
create trigger review_requests_snapshot_metrics
  after insert or update of sent_at, clicked_at on review_requests
  for each row
  execute function app.snapshot_review_metrics();
