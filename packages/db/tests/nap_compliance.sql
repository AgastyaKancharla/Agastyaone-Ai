-- =============================================================================
-- NMC/DCI compliance findings suite
--
-- nap_compliance_findings sits in the `shared_tables` RLS group alongside
-- nap_audits/nap_audit_results/nap_field_diffs: read for staff-with-access AND
-- for the client that owns the tenant, write for staff only. This is the
-- acceptance test for that -- a client must see their own findings (that is
-- the whole point of running the check) and nothing of another clinic's, and
-- must not be able to write one directly (only the worker, via the service
-- role, does that).
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
-- Fixtures. Same fixed UUIDs as rls_isolation.sql / contacts_spine.sql.
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

insert into nap_source_of_truth (id, tenant_id, location_id, business_name, website) values
  ('dddddddd-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
   'Test Clinic A','https://testclinica.example');

insert into nap_audits (id, tenant_id, location_id, source_of_truth_id, status,
                         website_checked_for_compliance, compliance_score, is_compliant)
values
  ('eeeeeeee-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001','dddddddd-0000-4000-8000-000000000001',
   'completed', true, 80, false);

-- One violation and one missing disclosure -- tenant A's clinic advertises a
-- superlative claim and has no visible privacy policy.
insert into nap_compliance_findings (tenant_id, audit_id, kind, rule_label, severity, snippet, remediation) values
  ('aaaaaaaa-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001',
   'violation','Prohibited superlative claims (NMC Reg 2023, Ch. 4)','high','best dentist',
   'Remove comparative superlatives.'),
  ('aaaaaaaa-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000001',
   'missing_disclosure','Healthcare privacy policy / patient data notice missing',null,null,null);

-- ===========================================================================
-- 1. Client A sees their own clinic's findings, and only what they can act on.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);

select pg_temp.eq((select count(*) from nap_compliance_findings)::int, 2,
                  'client A: sees both findings on their own audit');
select pg_temp.eq((select count(*) from nap_compliance_findings where kind = 'violation')::int, 1,
                  'client A: exactly one violation');

select pg_temp.denied(
  $q$insert into nap_compliance_findings (tenant_id, audit_id, kind, rule_label)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'eeeeeeee-0000-4000-8000-000000000001'::uuid,
             'violation','Injected by client A')$q$,
  'client A: cannot write a finding, even on their own audit');

-- A DELETE's USING clause filters rows out of the statement silently -- zero
-- rows affected, no exception -- unlike INSERT's WITH CHECK, which actively
-- raises. So this is asserted by what survives, not by pg_temp.denied.
delete from nap_compliance_findings where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'::uuid;
reset role;
select pg_temp.eq((select count(*) from nap_compliance_findings
                    where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int, 2,
                  'client A: a delete attempt removes nothing -- RLS hides the rows rather than erroring');

-- ===========================================================================
-- 2. Client B, a different clinic, sees none of it.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select count(*) from nap_compliance_findings)::int, 0,
                  'client B: sees no findings from another clinic''s audit');
reset role;

-- ===========================================================================
-- 3. All-scope staff can read across tenants and can write -- this is the
--    role the worker's own writes are modelled on (the worker itself uses the
--    service role and bypasses RLS entirely, but the policy must still permit
--    a staff-driven correction from the Console if one is ever needed).
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.eq((select count(*) from nap_compliance_findings)::int, 2, 'staff: sees tenant A''s findings');

-- A data-modifying statement can't sit inside pg_temp.eq's argument (Postgres
-- requires a writable CTE at the top level), so the insert and the assertion
-- are separate statements.
insert into nap_compliance_findings (tenant_id, audit_id, kind, rule_label)
values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'eeeeeeee-0000-4000-8000-000000000001'::uuid,
        'disclosure_present','Doctor qualifications displayed (BDS)');
select pg_temp.eq((select count(*) from nap_compliance_findings
                    where rule_label = 'Doctor qualifications displayed (BDS)')::int,
                  1, 'staff: can record a finding');
reset role;

-- ===========================================================================
-- 4. The audit's own summary columns read back what the worker would have
--    written -- not a policy assertion, but the fixture is worthless as a
--    regression check if these silently drift out of sync with the schema.
-- ===========================================================================
select pg_temp.eq((select website_checked_for_compliance from nap_audits
                    where id = 'eeeeeeee-0000-4000-8000-000000000001')::boolean, true,
                  'audit: website_checked_for_compliance set');
select pg_temp.eq((select is_compliant from nap_audits
                    where id = 'eeeeeeee-0000-4000-8000-000000000001')::boolean, false,
                  'audit: is_compliant false when a violation was found');

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
    raise exception 'NAP compliance: % of % assertions FAILED',
      v_failed, (select count(*) from _assert);
  end if;
  raise notice 'NAP compliance: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
