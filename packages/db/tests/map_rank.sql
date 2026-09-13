-- =============================================================================
-- Geo-grid map rank suite
--
-- Four things are asserted, in order of how expensive they would be to get
-- wrong:
--
--   1. THE COVERAGE GATE. A scan that lost too many points to rate limiting
--      must contribute nothing to the trend line. This is the one that would
--      cost a client relationship: a CAPTCHA storm rendering as a ranking
--      collapse, or worse, forty lucky points rendering as a triumph.
--   2. Resume idempotency. (scan_id, idx) is unique, so a pgmq redelivery
--      overwrites rather than duplicates -- and does not bill a second scan.
--   3. The rank/status invariant: a rank only exists where the clinic was
--      actually found.
--   4. Tenant isolation across all five tables, and that enqueue refuses the
--      three ways a scan can be meaningless.
--
-- Same conventions as the other suites: dependency-free, fully transactional,
-- roles simulated the way PostgREST does it.
-- =============================================================================

begin;

create temp table _assert (n serial, ok boolean, name text, detail text) on commit drop;
grant all on _assert to public;
grant usage, select on sequence _assert_n_seq to public;

create or replace function pg_temp.eq(actual anyelement, expected anyelement, name text)
returns void language plpgsql as $$
begin
  insert into _assert (ok, name, detail)
  values (actual is not distinct from expected, name,
          case when actual is not distinct from expected then ''
               else format('expected %L, got %L', expected, actual) end);
end;
$$;

create or replace function pg_temp.denied(stmt text, name text)
returns void language plpgsql as $$
begin
  execute stmt;
  insert into _assert (ok, name, detail) values (false, name, 'statement was ALLOWED');
exception when others then
  insert into _assert (ok, name, detail) values (true, name, 'refused: ' || sqlstate);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures. Same fixed UUIDs as the other suites.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-all@test.local'),
  ('33333333-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.local'),
  ('44444444-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-b@test.local');

insert into profiles (id, email, full_name, user_type) values
  ('11111111-0000-4000-8000-000000000001','staff-all@test.local','Staff All','staff'),
  ('33333333-0000-4000-8000-000000000003','client-a@test.local','Client A','client'),
  ('44444444-0000-4000-8000-000000000004','client-b@test.local','Client B','client')
on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;

insert into tenants (id, slug, name, vertical, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','test-clinic-a','Test Clinic A','dental','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','test-clinic-b','Test Clinic B','dental','active');

insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001','all','active')
on conflict (profile_id) do update set tenant_scope = excluded.tenant_scope;

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','client_owner','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','44444444-0000-4000-8000-000000000004','client_owner','active');

-- Koramangala, with coordinates. The second location deliberately has none.
insert into tenant_locations (id, tenant_id, name, city, state_code, is_primary, latitude, longitude, geo_source) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Clinic A - Koramangala','Bengaluru','29',true, 12.935200, 77.624500, 'google_place'),
  ('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Clinic A - No Coords','Bengaluru','29',false, null, null, null);

insert into map_keywords (tenant_id, location_id, phrase) values
  ('aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','dental clinic in koramangala');

-- ===========================================================================
-- 1. The rank/status invariant.
-- ===========================================================================
insert into map_scans (id, tenant_id, location_id, keyword, grid_size, spacing_m, center_lat, center_lng, status, points_requested)
values ('dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001','dental clinic in koramangala', 9, 800, 12.935200, 77.624500, 'running', 81);

select pg_temp.denied(
  $q$insert into map_scan_points (tenant_id, scan_id, idx, row_n, col_n, lat, lng, status, rank)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'dddddddd-0000-4000-8000-000000000001'::uuid,
             0,0,0,12.9,77.6,'blocked',3)$q$,
  'schema: a point we could not check cannot carry a rank');

select pg_temp.denied(
  $q$insert into map_scan_points (tenant_id, scan_id, idx, row_n, col_n, lat, lng, status, rank)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'dddddddd-0000-4000-8000-000000000001'::uuid,
             0,0,0,12.9,77.6,'found',null)$q$,
  'schema: a found point must say where it was found');

-- ===========================================================================
-- 2. Resume idempotency: a redelivered job overwrites its own points.
-- ===========================================================================
insert into map_scan_points (tenant_id, scan_id, idx, row_n, col_n, lat, lng, status, rank)
values ('aaaaaaaa-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001',
        0, 0, 0, 12.9380, 77.6215, 'blocked', null);

insert into map_scan_points (tenant_id, scan_id, idx, row_n, col_n, lat, lng, status, rank)
values ('aaaaaaaa-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001',
        0, 0, 0, 12.9380, 77.6215, 'found', 2)
on conflict (scan_id, idx) do update
  set status = excluded.status, rank = excluded.rank;

select pg_temp.eq((select count(*)::int from map_scan_points
                    where scan_id = 'dddddddd-0000-4000-8000-000000000001'),
                  1, 'resume: a re-scanned point updates in place rather than duplicating');
select pg_temp.eq((select rank from map_scan_points
                    where scan_id = 'dddddddd-0000-4000-8000-000000000001' and idx = 0),
                  2, 'resume: the retry''s better result wins');

-- ===========================================================================
-- 3. THE COVERAGE GATE. The assertion this suite exists for.
-- ===========================================================================

-- 3a. A scan that lost a quarter of its grid writes nothing, even though every
--     point it DID read was a first-place ranking. Charting this would show a
--     clinic a spike it never earned.
update map_scans
   set status = 'partial', score = 100, solv = 100, arp = 1.00,
       coverage_pct = 49.38, points_scanned = 40, completed_at = now()
 where id = 'dddddddd-0000-4000-8000-000000000001';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code like 'map_rank%'),
                  0, 'coverage gate: a 49%-coverage scan writes NO trend point, however good it looked');

-- 3b. A partial scan that still cleared 80% is a legitimate measurement and is
--     charted -- 'partial' is about completeness, not validity.
insert into map_scans (id, tenant_id, location_id, keyword, grid_size, spacing_m, center_lat, center_lng, status, points_requested)
values ('dddddddd-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001','dental clinic in koramangala', 9, 800, 12.935200, 77.624500, 'running', 81);

update map_scans
   set status = 'partial', score = 62, solv = 33.30, arp = 4.20,
       coverage_pct = 88.89, points_scanned = 72, completed_at = now()
 where id = 'dddddddd-0000-4000-8000-000000000002';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code like 'map_rank%'),
                  3, 'coverage gate: an 89%-coverage partial scan DOES chart, all three metrics');

select pg_temp.eq((select value from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code = 'map_rank_solv'),
                  33.3000, 'coverage gate: SoLV snapshotted from the scan header');

-- 3c. Found nowhere: ARP is absent rather than charted as zero, which would
--     read as "ranked first everywhere" -- the exact opposite of the truth.
insert into map_scans (id, tenant_id, location_id, keyword, grid_size, spacing_m, center_lat, center_lng, status, points_requested)
values ('dddddddd-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002',
        'cccccccc-0000-4000-8000-000000000001','invisible clinic', 9, 800, 12.935200, 77.624500, 'running', 81);

update map_scans
   set status = 'completed', score = 0, solv = 0, arp = null,
       coverage_pct = 100, points_scanned = 81, completed_at = now()
 where id = 'dddddddd-0000-4000-8000-000000000003';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'
                      and metric_code = 'map_rank_arp'),
                  0, 'null ARP writes no point: absent is not the same as first place');
select pg_temp.eq((select value from metric_snapshots
                    where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'
                      and metric_code = 'map_rank_score'),
                  0.0000, 'but a genuine zero score IS charted -- measured, and invisible');

-- ===========================================================================
-- 4. enqueue refuses the three ways a scan would be meaningless.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select enqueue_map_scans('cccccccc-0000-4000-8000-000000000001'::uuid)$q$,
  'enqueue: a client cannot queue a scan, even on their own location');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

select pg_temp.denied(
  $q$select enqueue_map_scans('cccccccc-0000-4000-8000-000000000002'::uuid)$q$,
  'enqueue: refuses a location with no coordinates rather than scanning latitude zero');

select pg_temp.denied(
  $q$select enqueue_map_scans('cccccccc-0000-4000-8000-000000000001'::uuid, 8)$q$,
  'enqueue: refuses an even grid, which has no centre cell');

-- One active keyword exists, so this succeeds and queues exactly one scan.
select pg_temp.eq(enqueue_map_scans('cccccccc-0000-4000-8000-000000000001'::uuid), 1,
                  'enqueue: queues one scan per active keyword');
reset role;

-- ===========================================================================
-- 5. Tenant isolation across all five tables.
-- ===========================================================================
insert into map_scan_competitors (tenant_id, scan_id, point_idx, rank, name)
values ('aaaaaaaa-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001',0,1,'Demo Dental A');
insert into map_scan_competitor_rollup (tenant_id, scan_id, name, points_seen, avg_rank, solv)
values ('aaaaaaaa-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001','Demo Dental A',1,1.00,100.00);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from map_keywords), 0, 'client B: sees no keywords of another clinic');
select pg_temp.eq((select count(*)::int from map_scan_points), 0, 'client B: sees no points of another clinic');
select pg_temp.eq((select count(*)::int from map_scan_competitors), 0, 'client B: sees no competitors of another clinic');
select pg_temp.eq((select count(*)::int from map_scan_competitor_rollup), 0, 'client B: sees no rollup of another clinic');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from map_scan_points), 1, 'client A: sees their own scan points');
select pg_temp.denied(
  $q$insert into map_keywords (tenant_id, location_id, phrase)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'cccccccc-0000-4000-8000-000000000001'::uuid,'injected')$q$,
  'client A: cannot add a tracked phrase themselves');
reset role;

-- ===========================================================================
-- Report. Raises on any failure so a non-zero exit fails the build.
-- ===========================================================================
select n, case when ok then 'ok  ' else 'FAIL' end as result, name, detail
from _assert order by n;

do $$
declare v_failed int;
begin
  select count(*) into v_failed from _assert where not ok;
  if v_failed > 0 then
    raise exception 'Map rank: % of % assertions FAILED',
      v_failed, (select count(*) from _assert);
  end if;
  raise notice 'Map rank: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
