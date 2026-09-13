-- =============================================================================
-- 0025_map_rank
--
-- Geo-grid map rank: where a clinic actually appears on Google Maps across the
-- area a patient would search from. The Local Falcon equivalent, and the
-- heaviest pillar in the Digital Visibility score.
--
-- WHY A GRID AND NOT A RANK
--
-- "You rank 4th for dental clinic" is close to meaningless locally. Google
-- ranks against where the SEARCHER is, so a clinic can be 1st on its own
-- doorstep and invisible two kilometres away -- which is exactly the area a
-- patient is choosing from. One number hides that; a grid of ranks is the
-- finding.
--
-- THE CENTRE PROBLEM THIS ALSO FIXES
--
-- tenant_locations has carried latitude/longitude since 0002 and nothing has
-- ever written them: no form, no action, no RPC. A grid has no centre without
-- them, so geo_source is added here to record HOW a coordinate was obtained --
-- because a later re-sync from Google must never silently overwrite a pin a
-- human corrected by hand.
-- =============================================================================

alter table tenant_locations
  add column geo_source text
    check (geo_source is null or geo_source in ('google_place','manual')),
  add column geo_updated_at timestamptz;

-- -----------------------------------------------------------------------------
-- Tracked phrases. No seeded defaults: a starter list belongs in the form's
-- placeholder text, not in rows every clinic inherits whether they fit or not.
-- -----------------------------------------------------------------------------
create table map_keywords (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  location_id uuid not null references tenant_locations(id) on delete cascade,
  phrase      text not null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint map_keywords_uniq unique (location_id, phrase)
);
create index map_keywords_tenant_idx on map_keywords (tenant_id, location_id, sort_order);

-- -----------------------------------------------------------------------------
-- Scan header. One row per keyword per run.
-- -----------------------------------------------------------------------------
create table map_scans (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  location_id       uuid not null references tenant_locations(id) on delete cascade,
  keyword           text not null,

  grid_size         integer not null,
  spacing_m         integer not null,
  -- Results read per point. Pinned at 20: ATRP scores a not-found point at
  -- depth + 1, so a changed depth silently rescales the whole series.
  depth             integer not null default 20,
  center_lat        numeric(9,6) not null,
  center_lng        numeric(9,6) not null,

  -- Null until the worker claims the job. Both are derived from the grid maths
  -- in packages/map-rank-engine (zoomForSpacing, gridFingerprint), and that is
  -- deliberately the ONLY implementation: mirroring a log2 formula and a string
  -- format into PL/pgSQL would give two definitions that drift apart silently,
  -- and a drifted fingerprint corrupts trend history rather than erroring.
  zoom              integer,
  provider_code     text,
  -- Identity of the MEASUREMENT, not the business. Snapshots are only written
  -- under a matching fingerprint, so widening the grid breaks the trend line
  -- honestly instead of pretending it continued.
  grid_fingerprint  text,

  -- 'partial' is a real, reportable outcome: a scan that lost eight points to
  -- rate limiting still knows something. Calling it 'failed' would throw away
  -- a usable answer; calling it 'completed' would overstate one.
  status            text not null default 'queued'
                      check (status in ('queued','running','completed','partial','failed','cancelled')),
  requested_by      uuid references profiles(id) on delete set null,

  points_requested  integer not null default 0,
  points_scanned    integer not null default 0,
  points_found      integer not null default 0,
  points_blocked    integer not null default 0,
  points_errored    integer not null default 0,

  -- Null when found nowhere. Never 0, never depth -- see metrics.ts.
  arp               numeric(5,2),
  atrp              numeric(5,2),
  solv              numeric(5,2),
  score             numeric(5,2),
  coverage_pct      numeric(5,2),

  -- Millionths of a US dollar (the provider bills in USD), accumulated per
  -- attempt. A retry that resumes from partial points must not bill a second
  -- full scan, and this is how we prove it did not.
  cost_micros       bigint not null default 0,

  error_message     text,
  queued_at         timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index map_scans_tenant_time_idx   on map_scans (tenant_id, location_id, created_at desc);
create index map_scans_location_time_idx on map_scans (location_id, keyword, created_at desc);
create index map_scans_pending_idx       on map_scans (status) where status in ('queued','running');

-- -----------------------------------------------------------------------------
-- One row per grid point.
--
-- The unique (scan_id, idx) is load-bearing: the worker UPSERTS each point as
-- it lands, so a job redelivered by pgmq mid-scan resumes rather than
-- restarting -- which matters doubly when every point costs money.
-- -----------------------------------------------------------------------------
create table map_scan_points (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  scan_id          uuid not null references map_scans(id) on delete cascade,
  idx              integer not null,
  row_n            integer not null,
  col_n            integer not null,
  lat              numeric(9,6) not null,
  lng              numeric(9,6) not null,
  -- 'not_ranked': we looked and they are not in the top `depth`. Counts against
  --   the score. 'blocked'/'error'/'ambiguous': we could not look, or could not
  --   be sure -- excluded from every denominator instead.
  status           text not null
                     check (status in ('found','not_ranked','ambiguous','blocked','error')),
  rank             integer,
  matched_place_id text,
  result_count     integer,
  error_message    text,
  checked_at       timestamptz not null default now(),
  constraint map_scan_points_uniq unique (scan_id, idx),
  -- A rank only means something on a point where the business was found.
  constraint map_scan_points_rank_ck
    check ((status = 'found' and rank is not null) or (status <> 'found' and rank is null))
);
create index map_scan_points_tenant_idx on map_scan_points (tenant_id, scan_id, idx);

-- -----------------------------------------------------------------------------
-- Who outranks the clinic, capped at the top 3 per point.
--
-- Storing all 20 results per point would be ~5.9M rows a year at 100 clinics
-- for intelligence nobody reads past third place. Top 3 is ~1,800 per clinic
-- per month.
-- -----------------------------------------------------------------------------
create table map_scan_competitors (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  scan_id      uuid not null references map_scans(id) on delete cascade,
  point_idx    integer not null,
  rank         integer not null,
  place_id     text,
  name         text not null,
  rating       numeric(2,1),
  review_count integer
);
create index map_scan_competitors_tenant_idx on map_scan_competitors (tenant_id, scan_id, point_idx);

-- One row per rival per scan. This is what the Console actually reads -- the
-- per-point rows exist to compute it and to replay a heatmap, not to be listed.
create table map_scan_competitor_rollup (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  scan_id      uuid not null references map_scans(id) on delete cascade,
  place_id     text,
  name         text not null,
  points_seen  integer not null,
  avg_rank     numeric(5,2),
  solv         numeric(5,2),
  constraint map_scan_competitor_rollup_uniq unique (scan_id, name)
);
create index map_scan_competitor_rollup_tenant_idx
  on map_scan_competitor_rollup (tenant_id, scan_id, points_seen desc);

create trigger map_keywords_touch
  before update on map_keywords
  for each row execute function app.touch_updated_at();
create trigger map_scans_touch
  before update on map_scans
  for each row execute function app.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS: the `shared_tables` shape from 0009_rls.sql -- readable by staff with
-- access AND by client users of that tenant, writable by staff only. Hand
-- written because the 0009 DO-loop has already run.
--
-- Note the competitor tables carry the same CLIENT-readable policy as the rest.
-- Keeping rival names out of the Portal is a decision the UI makes, not the
-- database: the rows are the client's own scan, and a policy that pretended
-- otherwise would be security theatre that the Console then has to work around.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'map_keywords',
    'map_scans',
    'map_scan_points',
    'map_scan_competitors',
    'map_scan_competitor_rollup'
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
