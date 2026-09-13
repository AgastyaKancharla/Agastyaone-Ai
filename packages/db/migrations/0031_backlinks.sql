-- =============================================================================
-- 0031_backlinks
--
-- Backlinks: the sixth and final Digital Visibility pillar. One check per
-- location against its live website's own summary link profile -- referring
-- domains, total backlinks, and an average spam score across those domains --
-- never the raw backlink list, which a client-facing score has no use for.
--
-- WHY THIS IS THE LIGHTEST-WEIGHT PILLAR OF THE SIX
--
-- Unlike a map-rank grid (81 lookups) or an AI-visibility sweep (4 engines x
-- N prompts), a backlink profile check is ONE cheap summary call per domain.
-- There is no grid to store, no per-point rows, no competitor rollup -- one
-- row per check is the whole schema.
--
-- WHY IT CANNOT SCORE WITHOUT A WEBSITE, UNLIKE THE COMPOSITE ITSELF
--
-- A visibility audit scores whatever it can reach even with no website on
-- file (0023's own reasoning). A backlinks check has nothing to check without
-- one, so -- like enqueue_map_scans refusing a location with no coordinates
-- -- enqueue_backlinks_check refuses outright rather than queueing a check
-- that can only ever fail.
-- =============================================================================

create table backlinks_checks (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  location_id        uuid not null references tenant_locations(id) on delete cascade,
  -- The domain actually checked, captured per run -- same reasoning
  -- visibility_audits.website_url is captured per run rather than joined
  -- live: a client who changes domain mid-year must not make an old check
  -- unattributable.
  domain             text not null,
  status             text not null default 'queued'
                       check (status in ('queued','running','completed','failed')),
  provider_code      text check (provider_code is null or provider_code in ('dataforseo_backlinks','fixture_backlinks')),

  referring_domains  integer,
  total_backlinks    integer,
  broken_backlinks   integer,
  -- Provider's own 0-100 average spam score across referring domains.
  spam_score         numeric(5,2),
  -- Provider's own proprietary authority-like rank. Stored for display only
  -- -- see backlinks-engine's own comment on why this is never scored on.
  domain_rank        integer,
  -- The pillar sub-score, computed once by computeBacklinksScore and stored
  -- here so the composite and the trend never recompute it differently.
  score              numeric(5,2),

  cost_micros        bigint not null default 0,
  error_message      text,
  requested_by       uuid references profiles(id) on delete set null,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  started_at         timestamptz,
  completed_at       timestamptz,

  -- A completed check has actually measured something. Mirrors
  -- visibility_pillar_scores' measured/score pairing and map_scan_points'
  -- status/rank pairing: the same class of invariant, enforced the same way.
  constraint backlinks_checks_completed_ck
    check (status <> 'completed' or (referring_domains is not null and score is not null))
);
create index backlinks_checks_tenant_time_idx    on backlinks_checks (tenant_id, created_at desc);
create index backlinks_checks_location_time_idx  on backlinks_checks (location_id, created_at desc);
create index backlinks_checks_pending_idx        on backlinks_checks (status) where status in ('queued','running');

create trigger backlinks_checks_touch
  before update on backlinks_checks
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: the same shared_tables shape 0022/0025/0028 all use -- readable by
-- staff with access AND by client users of that tenant, writable by staff
-- only. Written by hand for the same reason as those: the generic DO-loop in
-- 0009 has already run.
-- -----------------------------------------------------------------------------
alter table backlinks_checks enable row level security;
alter table backlinks_checks force  row level security;

create policy backlinks_checks_sel on backlinks_checks for select to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids())) );

create policy backlinks_checks_ins on backlinks_checks for insert to authenticated
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );

create policy backlinks_checks_upd on backlinks_checks for update to authenticated
  using      ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );

create policy backlinks_checks_del on backlinks_checks for delete to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
