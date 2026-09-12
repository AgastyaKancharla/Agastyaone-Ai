-- =============================================================================
-- Tenant isolation suite
--
-- The acceptance test for the whole security model. Shared-schema multi-tenancy
-- trades "one policy bug is a cross-tenant leak" for everything else it buys,
-- and this file is how that trade is paid for.
--
-- Deliberately DEPENDENCY-FREE. It originally used pgTAP, which was never
-- actually installed on Supabase — it was created inside each transaction and
-- rolled back — and which a stock Postgres container does not ship. Plain
-- assertions mean the identical file runs in CI and against the live project
-- with no extension anywhere.
--
-- Fully transactional: it ROLLBACKs and leaves nothing behind, so it is safe to
-- run against any environment.
--
-- Roles are simulated exactly as PostgREST does it: SET LOCAL ROLE plus a
-- request.jwt.claims GUC, which is what auth.uid() reads.
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

-- Asserts that a statement is REFUSED. A test that only checks reads would pass
-- against a database that lets clients write anything.
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
-- Fixtures. Fixed UUIDs so they can be written straight into the JWT claims.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-all@test.local'),
  ('22222222-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-assigned@test.local'),
  ('33333333-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.local'),
  ('44444444-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-b@test.local');

-- Upsert: since 0012 the on_auth_user_created trigger already provisioned a
-- profile for each row above. This overwrites the derived values with the
-- fixture's intent.
insert into profiles (id, email, full_name, user_type) values
  ('11111111-0000-4000-8000-000000000001','staff-all@test.local','Staff All','staff'),
  ('22222222-0000-4000-8000-000000000002','staff-assigned@test.local','Staff Assigned','staff'),
  ('33333333-0000-4000-8000-000000000003','client-a@test.local','Client A','client'),
  ('44444444-0000-4000-8000-000000000004','client-b@test.local','Client B','client')
on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;

insert into tenants (id, slug, name, vertical, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','test-clinic-a','Test Clinic A','dental','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','test-clinic-b','Test Clinic B','dental','active');

insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001','all','active'),
  ('22222222-0000-4000-8000-000000000002','assigned','active')
on conflict (profile_id) do update set tenant_scope = excluded.tenant_scope;

-- The assigned-scope staff member is attached to tenant A only.
insert into account_assignments (tenant_id, staff_id, role, status)
select 'aaaaaaaa-0000-4000-8000-000000000001', s.id, 'specialist', 'active'
from staff_members s where s.profile_id = '22222222-0000-4000-8000-000000000002';

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','client_owner','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','44444444-0000-4000-8000-000000000004','client_owner','active');

insert into tenant_locations (tenant_id, name, city, state_code, is_primary) values
  ('aaaaaaaa-0000-4000-8000-000000000001','Clinic A - Koramangala','Bengaluru','29',true),
  ('bbbbbbbb-0000-4000-8000-000000000002','Clinic B - Indiranagar','Bengaluru','29',true);

insert into contacts (tenant_id, contact_kind, full_name, primary_phone_raw) values
  ('aaaaaaaa-0000-4000-8000-000000000001','patient','Patient A','9876543210'),
  ('bbbbbbbb-0000-4000-8000-000000000002','patient','Patient B','9876500000');

-- Cost data. Clients must never see this, even for their own tenant.
insert into time_entries (tenant_id, staff_id, entry_date, hours, is_billable)
select 'aaaaaaaa-0000-4000-8000-000000000001', s.id, current_date, 2.5, true
from staff_members s where s.profile_id = '11111111-0000-4000-8000-000000000001';

-- One client-visible document and one internal, same tenant.
insert into documents (tenant_id, kind, title, storage_path, is_client_visible) values
  ('aaaaaaaa-0000-4000-8000-000000000001','report','Visible report','a/visible.pdf',true),
  ('aaaaaaaa-0000-4000-8000-000000000001','report','Internal report','a/internal.pdf',false);

-- ===========================================================================
-- 1. Anonymous. Refused at the GRANT layer, before RLS is even consulted —
--    two independent barriers, and this fails loudly if either is relaxed.
-- ===========================================================================
set local role anon;
select pg_temp.denied('select count(*) from tenants',  'anon: denied on tenants before RLS');
select pg_temp.denied('select count(*) from contacts', 'anon: denied on contacts too');
reset role;

-- ===========================================================================
-- 2. Client A is confined to tenant A.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);

select pg_temp.eq((select count(*) from tenants)::int, 1, 'client A: sees exactly one tenant');
select pg_temp.eq((select slug from tenants)::text, 'test-clinic-a', 'client A: and it is their own');
select pg_temp.eq((select count(*) from contacts)::int, 1, 'client A: sees only own contacts');
select pg_temp.eq((select full_name from contacts)::text, 'Patient A', 'client A: cannot see tenant B patients');
select pg_temp.eq((select count(*) from tenant_locations)::int, 1, 'client A: sees only own locations');
select pg_temp.eq((select count(*) from time_entries)::int, 0, 'client A: cannot read cost data');
select pg_temp.eq((select count(*) from documents)::int, 1, 'client A: sees only client-visible documents');
select pg_temp.eq((select title from documents)::text, 'Visible report', 'client A: internal document hidden');

select pg_temp.denied(
  $q$insert into contacts (tenant_id, contact_kind, full_name)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'patient','Injected')$q$,
  'client A: cannot insert into own tenant');
select pg_temp.denied(
  $q$insert into contacts (tenant_id, contact_kind, full_name)
     values ('bbbbbbbb-0000-4000-8000-000000000002'::uuid,'patient','Injected')$q$,
  'client A: cannot insert into tenant B');
reset role;

-- ===========================================================================
-- 3. Client B is the mirror image — proves the policy is not accidentally
--    keyed to "whichever tenant happens to be first".
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select full_name from contacts)::text, 'Patient B', 'client B: sees only their own patient');
reset role;

-- ===========================================================================
-- 4. Staff scoping. Role decides capability; tenant_scope decides visibility.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.eq((select count(*) from tenants)::int, 1, 'assigned staff: sees only assigned accounts');
select pg_temp.eq((select count(*) from contacts)::int, 1, 'assigned staff: no unassigned tenant data');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- Scoped to the fixtures: an absolute count would also pick up the seeded
-- AgastyaOne tenant and make this depend on seed state.
select pg_temp.eq((select count(*) from tenants where slug like 'test-clinic-%')::int, 2,
                  'all-scope staff: sees both tenants, assigned or not');
select pg_temp.eq((select count(*) from time_entries)::int, 1, 'all-scope staff: can read cost data');
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
    raise exception 'Tenant isolation: % of % assertions FAILED',
      v_failed, (select count(*) from _assert);
  end if;
  raise notice 'Tenant isolation: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
