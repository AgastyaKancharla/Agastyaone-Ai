-- =============================================================================
-- 0011_tenant_leading_indexes
--
-- Caught by schema guard #5. Each of these tables carries tenant_id and has an
-- RLS policy filtering on it, but had no index with tenant_id as the LEADING
-- column -- so the policy predicate could not use an index and the planner
-- would fall back to a sequential scan on every read.
--
-- The composites are chosen to match the access pattern each table actually
-- has (tenant, then the column the UI sorts or filters by), so one index serves
-- both the security predicate and the query.
--
-- notifications and webhook_events are deliberately excluded: neither has a
-- tenant_id-based policy (notifications is scoped by profile_id, webhook_events
-- is service-role only), so a tenant_id index would earn nothing.
-- =============================================================================

create index if not exists campaign_messages_tenant_idx    on campaign_messages    (tenant_id, status, scheduled_for);
create index if not exists citations_tenant_idx            on citations            (tenant_id, location_id);
create index if not exists credit_notes_tenant_idx         on credit_notes         (tenant_id, issue_date desc);
create index if not exists engagement_tasks_tenant_idx     on engagement_tasks     (tenant_id, status);
create index if not exists feature_flags_tenant_idx        on feature_flags        (tenant_id);
create index if not exists geo_mentions_tenant_idx         on geo_mentions         (tenant_id, run_id);
create index if not exists idempotency_keys_tenant_idx     on idempotency_keys     (tenant_id);
create index if not exists invoice_lines_tenant_idx        on invoice_lines        (tenant_id, invoice_id);
create index if not exists nap_field_diffs_tenant_idx      on nap_field_diffs      (tenant_id, result_id);
create index if not exists nap_sot_tenant_idx              on nap_source_of_truth  (tenant_id, location_id, valid_from desc);
create index if not exists outbox_tenant_idx               on outbox               (tenant_id, status);
create index if not exists pipeline_stages_tenant_idx      on pipeline_stages      (tenant_id, pipeline_id);
create index if not exists review_responses_tenant_idx     on review_responses     (tenant_id, status);
create index if not exists review_sources_tenant_idx       on review_sources       (tenant_id, location_id);
create index if not exists schedules_tenant_idx            on schedules            (tenant_id);
create index if not exists staff_allocations_tenant_idx    on staff_allocations    (tenant_id, starts_on desc);

-- Correlated columns: without this the planner assumes tenant_id and
-- location_id are independent and badly misestimates rows on the very joins
-- the Console runs most.
create statistics if not exists contacts_tenant_location_stats  (dependencies, ndistinct)
  on tenant_id, location_id from contacts;
create statistics if not exists calls_tenant_location_stats     (dependencies, ndistinct)
  on tenant_id, location_id from calls;
create statistics if not exists bookings_tenant_location_stats  (dependencies, ndistinct)
  on tenant_id, location_id from bookings;

-- One tenant with 500k rows next to ninety-nine with 500 each produces a plan
-- tuned for the average and wrong at both ends. Raise the sample on the hottest
-- runtime tables.
alter table contacts       alter column tenant_id set statistics 1000;
alter table calls          alter column tenant_id set statistics 1000;
alter table messages       alter column tenant_id set statistics 1000;
alter table bookings       alter column tenant_id set statistics 1000;
alter table activity_log   alter column tenant_id set statistics 1000;
