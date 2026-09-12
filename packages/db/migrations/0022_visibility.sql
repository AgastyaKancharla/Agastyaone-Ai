-- =============================================================================
-- 0022_visibility
--
-- Digital Visibility: one score per location, composed of pillar sub-scores.
--
-- WHY A COMPOSITE AND NOT SIX SEPARATE PRODUCTS
--
-- A clinic owner does not ask "what is my citation consistency". They ask
-- "how visible am I". Six numbers is a report; one number is a product, and
-- one number is what can visibly go up month over month. The pillars stay
-- addressable underneath for the staff who have to actually fix something.
--
-- WHY PILLARS ARE ROWS AND NOT COLUMNS ON THE HEADER
--
-- Pillars arrive one slice at a time (website now; map rank, AI visibility and
-- backlinks later) and their weights will be re-tuned once there is real data
-- to tune against. Columns would mean a migration per pillar and a rewrite of
-- history every time a weight changed. Rows mean a run records exactly which
-- pillars existed, what they scored and what they were worth ON THAT DAY --
-- so an old audit stays readable after the model moves on.
--
-- THE COVERAGE RULE
--
-- A pillar that could not be measured is recorded with measured = false and a
-- null score, and is excluded from the composite -- the remaining weights are
-- re-normalised over what was actually measured, and coverage_pct reports how
-- much of the model that was. This is the same discipline nap_audits already
-- applies to errored directories: an unreachable source is missing evidence,
-- not evidence of absence, and must never read to a client as "you scored 0".
-- =============================================================================

create table visibility_audits (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  location_id          uuid not null references tenant_locations(id) on delete cascade,
  service_instance_id  uuid references service_instances(id) on delete set null,
  status               text not null default 'queued'
                         check (status in ('queued','running','completed','failed','cancelled')),
  requested_by         uuid references profiles(id) on delete set null,

  -- The URL actually fetched, captured per run. A client who changes domain
  -- mid-year otherwise makes every historical website score unattributable --
  -- the same reason nap_audits pins source_of_truth_id.
  website_url          text,

  -- Weighted mean over measured pillars only, and the share of the model's
  -- total weight those pillars represent.
  composite_score      numeric(5,2),
  coverage_pct         numeric(5,2),

  error_message        text,
  queued_at            timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index visibility_audits_tenant_time_idx   on visibility_audits (tenant_id, created_at desc);
create index visibility_audits_location_time_idx on visibility_audits (location_id, created_at desc);
create index visibility_audits_pending_idx       on visibility_audits (status) where status in ('queued','running');

create table visibility_pillar_scores (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  audit_id    uuid not null references visibility_audits(id) on delete cascade,
  pillar      text not null
                check (pillar in ('map_rank','website','citations','reviews','ai_visibility','backlinks')),
  -- Null exactly when measured is false. Zero means "measured, and genuinely
  -- invisible" -- a different fact, and one worth charging to fix.
  score       numeric(5,2),
  -- The weight as it stood for this run, not as it stands today.
  weight      numeric(5,2) not null,
  measured    boolean not null default false,
  -- Pillar-specific evidence the UI can show without a table per pillar:
  -- for website, the three sub-scores; later, ARP/SoLV for map rank.
  detail      jsonb,
  created_at  timestamptz not null default now(),

  constraint visibility_pillar_scores_measured_ck
    check ((measured and score is not null) or (not measured and score is null)),
  -- One row per pillar per run. Makes the worker's write idempotent on retry.
  constraint visibility_pillar_scores_uniq unique (audit_id, pillar)
);
create index visibility_pillar_scores_tenant_idx on visibility_pillar_scores (tenant_id, audit_id);

create table visibility_website_findings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  audit_id      uuid not null references visibility_audits(id) on delete cascade,
  -- 'issue': present and wrong, or absent and required.
  -- 'opportunity': not wrong, but a real gain is available.
  -- 'passed': kept deliberately, so the client sees a complete checklist
  --   rather than only a list of faults -- same reasoning as
  --   nap_compliance_findings.disclosure_present.
  kind          text not null check (kind in ('issue','opportunity','passed')),
  -- Which search surface the signal serves. A clinic can be perfect for Google
  -- and invisible to ChatGPT, and the fixes differ, so these never merge.
  signal_group  text not null check (signal_group in ('seo','geo','aeo')),
  rule_label    text not null,
  severity      text check (severity is null or severity in ('high','medium','low')),
  snippet       text,
  remediation   text
);
create index visibility_website_findings_audit_idx  on visibility_website_findings (audit_id);
create index visibility_website_findings_tenant_idx on visibility_website_findings (tenant_id, audit_id);

create trigger visibility_audits_touch
  before update on visibility_audits
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: the `shared_tables` shape from 0009_rls.sql -- readable by staff with
-- access AND by client users of that tenant, writable by staff only. Written
-- by hand because the generic DO-loop in 0009 has already run and will not
-- pick up tables added afterwards.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'visibility_audits',
    'visibility_pillar_scores',
    'visibility_website_findings'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);

    execute format($p$
      create policy %I on %I for select to authenticated
        using ( tenant_id in (select unnest(app.accessible_tenant_ids())) )
    $p$, t || '_sel', t);

    execute format($p$
      create policy %I on %I for insert to authenticated
        with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
    $p$, t || '_ins', t);

    execute format($p$
      create policy %I on %I for update to authenticated
        using      ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
        with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
    $p$, t || '_upd', t);

    execute format($p$
      create policy %I on %I for delete to authenticated
        using ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
    $p$, t || '_del', t);
  end loop;
end $$;
