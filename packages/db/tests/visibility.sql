-- =============================================================================
-- Digital Visibility suite
--
-- Three things are asserted here, in order of how expensive they would be to
-- get wrong:
--
--   1. Tenant isolation on all three new tables -- a client sees their own
--      score and findings and nothing of another clinic's, and cannot write.
--   2. The measured/score invariant. A pillar that was not measured must carry
--      a NULL score, never a zero. This is the single assumption the whole
--      product rests on: a zero says "you are invisible" and a NULL says "we
--      could not look", and a bug that conflates them would quietly tell
--      paying clients their visibility collapsed.
--   3. The metrics trigger fires on completion, and skips NULL values rather
--      than charting them as zero.
--
-- Same conventions as rls_isolation.sql: dependency-free, fully transactional,
-- roles simulated the way PostgREST does it (SET LOCAL ROLE + request.jwt.claims).
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
-- Fixtures. Same fixed UUIDs as rls_isolation.sql / nap_compliance.sql.
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
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Clinic A - Koramangala','Bengaluru','29',true);

insert into visibility_audits (id, tenant_id, location_id, status, website_url)
values ('ffffffff-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001','running','https://testclinica.example');

-- Three measured, three not -- the exact shape of what Slice 6.1 ships.
insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured, detail) values
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','website',   72.00, 20, true,  '{"seo":80,"geo":70,"aeo":66}'),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','citations', 64.00, 20, true,  null),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','reviews',   40.00, 15, true,  null),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','map_rank',      null, 25, false, null),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','ai_visibility', null, 15, false, null),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','backlinks',     null,  5, false, null);

insert into visibility_website_findings (tenant_id, audit_id, kind, signal_group, rule_label, severity, remediation) values
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','issue','seo','No meta description','high','Add a meta description.'),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','issue','geo','No structured data at all','high','Add JSON-LD.'),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','opportunity','aeo','No FAQ structured data','high','Mark up patient questions.'),
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000001','passed','seo','Page title present',null,null);

-- ===========================================================================
-- 1. The measured/score invariant is enforced by the schema, not by hope.
-- ===========================================================================
select pg_temp.denied(
  $q$insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'ffffffff-0000-4000-8000-000000000001'::uuid,
             'map_rank', 0, 25, false)$q$,
  'schema: an unmeasured pillar cannot carry a score -- not even zero');

select pg_temp.denied(
  $q$insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'ffffffff-0000-4000-8000-000000000001'::uuid,
             'backlinks', null, 5, true)$q$,
  'schema: a measured pillar cannot carry a null score');

select pg_temp.denied(
  $q$insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'ffffffff-0000-4000-8000-000000000001'::uuid,
             'website', 50, 20, true)$q$,
  'schema: one row per pillar per audit -- a retry cannot double-count');

-- ===========================================================================
-- 2. Completion snapshots metrics, and skips what could not be measured.
-- ===========================================================================
update visibility_audits
   set status = 'completed', composite_score = 62.18, coverage_pct = 55.00, completed_at = now()
 where id = 'ffffffff-0000-4000-8000-000000000001';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code in ('visibility_score','visibility_coverage_pct',
                                          'visibility_website_score','visibility_issues_open')),
                  4, 'trigger: all four metrics snapshotted on completion');

select pg_temp.eq((select value from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code = 'visibility_website_score'),
                  72.0000, 'trigger: website pillar snapshotted from its own row');

select pg_temp.eq((select value from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code = 'visibility_issues_open'),
                  2.0000, 'trigger: counts issues only, not opportunities or passes');

-- A run where nothing could be measured must leave NO score point behind. A
-- zero here would draw a cliff on the client's chart that never happened.
insert into visibility_audits (id, tenant_id, location_id, status)
values ('ffffffff-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002',
        'cccccccc-0000-4000-8000-000000000001','running');
update visibility_audits set status = 'completed', composite_score = null, coverage_pct = 0, completed_at = now()
 where id = 'ffffffff-0000-4000-8000-000000000002';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'
                      and metric_code = 'visibility_score'),
                  0, 'trigger: a null composite writes no point at all, rather than a zero');

-- ===========================================================================
-- 3. Tenant isolation across all three tables.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);

select pg_temp.eq((select count(*)::int from visibility_audits), 1,
                  'client A: sees their own audit only');
select pg_temp.eq((select count(*)::int from visibility_pillar_scores), 6,
                  'client A: sees all six pillars, including the unmeasured ones');
select pg_temp.eq((select count(*)::int from visibility_website_findings), 4,
                  'client A: sees their own findings');

select pg_temp.denied(
  $q$insert into visibility_website_findings (tenant_id, audit_id, kind, signal_group, rule_label)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'ffffffff-0000-4000-8000-000000000001'::uuid,
             'passed','seo','Injected by client A')$q$,
  'client A: cannot write a finding, even on their own audit');

-- An UPDATE's USING clause filters rows out of the statement silently -- zero
-- rows affected, no exception -- unlike INSERT's WITH CHECK, which actively
-- raises. So this is asserted by what survives, not by pg_temp.denied: the
-- same distinction nap_compliance.sql draws for DELETE.
update visibility_audits set composite_score = 100
 where id = 'ffffffff-0000-4000-8000-000000000001'::uuid;
reset role;

select pg_temp.eq((select composite_score from visibility_audits
                    where id = 'ffffffff-0000-4000-8000-000000000001'),
                  62.18, 'client A: an update attempt changes nothing -- RLS hides the row rather than erroring');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from visibility_pillar_scores), 0,
                  'client B: sees no pillar scores from another clinic');
select pg_temp.eq((select count(*)::int from visibility_website_findings), 0,
                  'client B: sees no findings from another clinic');
reset role;

-- ===========================================================================
-- 4. All-scope staff read across tenants and can write.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from visibility_audits), 2, 'staff: sees both tenants'' audits');

insert into visibility_website_findings (tenant_id, audit_id, kind, signal_group, rule_label)
values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'ffffffff-0000-4000-8000-000000000001'::uuid,
        'passed','aeo','Locality named in the content');
select pg_temp.eq((select count(*)::int from visibility_website_findings
                    where rule_label = 'Locality named in the content'),
                  1, 'staff: can record a finding');
reset role;

-- ===========================================================================
-- 5. enqueue_visibility_audit refuses a location the caller cannot reach.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select enqueue_visibility_audit('cccccccc-0000-4000-8000-000000000001'::uuid)$q$,
  'enqueue: a client cannot queue an audit, even on their own location');
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
    raise exception 'Visibility: % of % assertions FAILED',
      v_failed, (select count(*) from _assert);
  end if;
  raise notice 'Visibility: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
