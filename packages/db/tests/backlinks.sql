-- =============================================================================
-- Backlinks suite
--
-- Four things are asserted, in order of how expensive they would be to get
-- wrong:
--
--   1. The completed/measured invariant (0031's own CHECK): a 'completed'
--      check without a score is self-contradictory data, the same class of
--      defect map_scan_points' rank/status check and geo_runs' position
--      check both exist to prevent.
--   2. enqueue_backlinks_check: staff-only, refuses a location with no
--      website on file, and normalises whatever website value it finds
--      (scheme, www, path, query, all vary between what a client typed and
--      what a provider expects as `target`) to the SAME bare domain every
--      time -- otherwise the same site's history would never line up.
--   3. The metrics trigger extension (0033): visibility_backlinks_score
--      snapshots when the pillar was measured, and stays absent -- not zero
--      -- when it was not.
--   4. Tenant isolation.
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

insert into tenant_locations (id, tenant_id, name, city, state_code, is_primary) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Clinic A - Koramangala','Bengaluru','29',true),
  ('cccccccc-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','Clinic A - No Website','Bengaluru','29',false);

-- A deliberately messy value: scheme, WWW, a path and a query string, so the
-- enqueue test below proves every one of them gets stripped.
insert into nap_source_of_truth (tenant_id, location_id, website, is_current)
values ('aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
        'HTTPS://WWW.TestClinicA.example/book-now?ref=gbp', true);

-- ===========================================================================
-- 1. The completed/measured invariant.
-- ===========================================================================
select pg_temp.denied(
  $q$insert into backlinks_checks (tenant_id, location_id, domain, status)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'cccccccc-0000-4000-8000-000000000001'::uuid,
             'testclinica.example','completed')$q$,
  'schema: a completed check without a score or referring-domain count is self-contradictory');

insert into backlinks_checks (tenant_id, location_id, domain, status, referring_domains, total_backlinks, score)
values ('aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
        'testclinica.example','completed', 0, 0, 0);
select pg_temp.eq((select score from backlinks_checks where domain = 'testclinica.example' and status = 'completed'),
                  0.00, 'schema: zero referring domains is a real, measured zero -- allowed to complete');

-- ===========================================================================
-- 2. enqueue_backlinks_check.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select enqueue_backlinks_check('cccccccc-0000-4000-8000-000000000001'::uuid)$q$,
  'enqueue: a client cannot queue a check, even on their own location');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

select pg_temp.denied(
  $q$select enqueue_backlinks_check('cccccccc-0000-4000-8000-000000000002'::uuid)$q$,
  'enqueue: refuses a location with no website on file rather than checking nothing');

select enqueue_backlinks_check('cccccccc-0000-4000-8000-000000000001'::uuid);
reset role;

select pg_temp.eq((select domain from backlinks_checks
                    where location_id = 'cccccccc-0000-4000-8000-000000000001' and status = 'queued'),
                  'testclinica.example',
                  'enqueue: scheme, WWW, path and query are all stripped to the bare domain');
select pg_temp.eq((select count(*)::int from pgmq.messages where queue_name = 'backlinks_checks'),
                  1, 'enqueue: a real pgmq message exists for the queued check');

-- ===========================================================================
-- 3. The metrics trigger extension (0033) -- visibility_backlinks_score.
-- ===========================================================================
insert into visibility_audits (id, tenant_id, location_id, status, website_url)
values ('ffffffff-0000-4000-8000-000000000020','aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001','running','https://testclinica.example');

insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured) values
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000020','backlinks', 37.00, 5, true);

update visibility_audits
   set status = 'completed', composite_score = 37.00, coverage_pct = 5.00, completed_at = now()
 where id = 'ffffffff-0000-4000-8000-000000000020';

select pg_temp.eq((select value from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code = 'visibility_backlinks_score'),
                  37.0000, 'trigger: visibility_backlinks_score snapshotted from the measured backlinks pillar');

insert into visibility_audits (id, tenant_id, location_id, status)
values ('ffffffff-0000-4000-8000-000000000021','bbbbbbbb-0000-4000-8000-000000000002',
        'cccccccc-0000-4000-8000-000000000001','running');
insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured) values
  ('bbbbbbbb-0000-4000-8000-000000000002','ffffffff-0000-4000-8000-000000000021','backlinks', null, 5, false);
update visibility_audits
   set status = 'completed', composite_score = null, coverage_pct = 0, completed_at = now()
 where id = 'ffffffff-0000-4000-8000-000000000021';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'
                      and metric_code = 'visibility_backlinks_score'),
                  0, 'trigger: an unmeasured backlinks pillar writes no point at all');

-- ===========================================================================
-- 4. Tenant isolation.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from backlinks_checks), 0, 'client B: sees no checks of another clinic');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
-- Only 2, not 3: the denied insert in section 1 raised inside its own
-- implicit subtransaction and rolled back, so it never left a row behind.
select pg_temp.eq((select count(*)::int from backlinks_checks), 2, 'client A: sees their own checks -- 1 fixture plus 1 enqueued');
select pg_temp.denied(
  $q$insert into backlinks_checks (tenant_id, location_id, domain, status)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'cccccccc-0000-4000-8000-000000000001'::uuid,
             'injected.example','queued')$q$,
  'client A: cannot queue a check by inserting directly -- staff only');
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
    raise exception 'Backlinks: % of % assertions FAILED',
      v_failed, (select count(*) from _assert);
  end if;
  raise notice 'Backlinks: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
