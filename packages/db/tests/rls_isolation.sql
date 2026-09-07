-- =============================================================================
-- Tenant isolation suite (pgTAP)
--
-- This is the acceptance test for the whole security model. Shared-schema
-- multi-tenancy trades "one policy bug is a cross-tenant leak" for everything
-- else it buys, and this file is how that trade is paid for.
--
-- Runs entirely inside a transaction and ROLLBACKs, so it leaves no rows behind
-- and is safe against any environment.
--
-- Roles are simulated the way PostgREST does it: SET LOCAL ROLE authenticated
-- plus a request.jwt.claims GUC, which is what auth.uid() reads.
-- =============================================================================

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

-- -----------------------------------------------------------------------------
-- Fixtures. Fixed UUIDs so they can be written straight into the JWT claims.
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
values
  ('11111111-0000-4000-8000-000000000001'::uuid,      '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff-all@test.local',      now(), now()),
  ('22222222-0000-4000-8000-000000000002'::uuid,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff-assigned@test.local', now(), now()),
  ('33333333-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-a@test.local',       now(), now()),
  ('44444444-0000-4000-8000-000000000004'::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-b@test.local',       now(), now());

-- Upsert, not insert: since 0012 the on_auth_user_created trigger already
-- provisioned a profile for every auth.users row above. This overwrites the
-- derived values with what the fixture intends.
insert into profiles (id, email, full_name, user_type) values
  ('11111111-0000-4000-8000-000000000001'::uuid,      'staff-all@test.local',      'Staff All',      'staff'),
  ('22222222-0000-4000-8000-000000000002'::uuid,   'staff-assigned@test.local', 'Staff Assigned', 'staff'),
  ('33333333-0000-4000-8000-000000000003'::uuid, 'client-a@test.local',       'Client A',       'client'),
  ('44444444-0000-4000-8000-000000000004'::uuid, 'client-b@test.local',       'Client B',       'client')
on conflict (id) do update
  set full_name = excluded.full_name, user_type = excluded.user_type;

insert into tenants (id, slug, name, vertical, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'test-clinic-a', 'Test Clinic A', 'dental', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'test-clinic-b', 'Test Clinic B', 'dental', 'active');

-- Also an upsert: an @agastyaone.com fixture would already have been promoted
-- to staff by the 0012 trigger. These addresses are not, but keeping the upsert
-- means the suite does not care either way.
insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001'::uuid,    'all',      'active'),
  ('22222222-0000-4000-8000-000000000002'::uuid, 'assigned', 'active')
on conflict (profile_id) do update set tenant_scope = excluded.tenant_scope;

-- The assigned-scope staff member is attached to tenant A only.
insert into account_assignments (tenant_id, staff_id, role, status)
select 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, s.id, 'specialist', 'active'
from staff_members s where s.profile_id = '22222222-0000-4000-8000-000000000002'::uuid;

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, '33333333-0000-4000-8000-000000000003'::uuid, 'client_owner', 'active'),
  ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, '44444444-0000-4000-8000-000000000004'::uuid, 'client_owner', 'active');

insert into tenant_locations (tenant_id, name, city, state_code, is_primary) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'Clinic A - Koramangala', 'Bengaluru', '29', true),
  ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'Clinic B - Indiranagar',  'Bengaluru', '29', true);

insert into contacts (tenant_id, contact_kind, full_name, primary_phone_raw) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'patient', 'Patient A', '9876543210'),
  ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'patient', 'Patient B', '9876500000');

-- Cost data: clients must never see this, even for their own tenant.
insert into time_entries (tenant_id, staff_id, entry_date, hours, is_billable)
select 'aaaaaaaa-0000-4000-8000-000000000001'::uuid, s.id, current_date, 2.5, true
from staff_members s where s.profile_id = '11111111-0000-4000-8000-000000000001'::uuid;

-- One client-visible document and one internal one, same tenant.
insert into documents (tenant_id, kind, title, storage_path, is_client_visible) values
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'report', 'Visible report',  'a/visible.pdf',  true),
  ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'report', 'Internal report', 'a/internal.pdf', false);

-- =============================================================================
-- 1. Anonymous sees nothing.
-- =============================================================================
set local role anon;
-- Note this asserts a THROW, not an empty result. anon holds no grant at all
-- on public, so it is refused at the privilege layer before RLS is consulted.
-- Two independent barriers, and this test fails loudly if either is relaxed.
select throws_ok( $q$ select count(*) from tenants  $q$, '42501', null,
                  'anon: denied at the grant layer, before RLS' );
select throws_ok( $q$ select count(*) from contacts $q$, '42501', null,
                  'anon: denied on contacts too' );
reset role;

-- =============================================================================
-- 2. Client A is confined to tenant A.
-- =============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is( (select count(*) from tenants)::int,   1, 'client A: sees exactly one tenant' );
select is( (select slug from tenants)::text, 'test-clinic-a', 'client A: and it is their own' );
select is( (select count(*) from contacts)::int,  1, 'client A: sees only own contacts' );
select is( (select full_name from contacts)::text, 'Patient A', 'client A: cannot see tenant B patients' );
select is( (select count(*) from tenant_locations)::int, 1, 'client A: sees only own locations' );

-- Staff-only table: invisible even for their own tenant.
select is( (select count(*) from time_entries)::int, 0, 'client A: cannot read time entries (cost data)' );

-- Document visibility is per-row, not per-bucket.
select is( (select count(*) from documents)::int, 1, 'client A: sees only client-visible documents' );
select is( (select title from documents)::text, 'Visible report', 'client A: internal document is hidden' );

-- Writes are refused: clients are read-only through RLS.
select throws_ok(
  $$ insert into contacts (tenant_id, contact_kind, full_name)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'patient', 'Injected') $$,
  '42501', null, 'client A: cannot insert contacts' );

-- Cross-tenant write is refused too.
select throws_ok(
  $$ insert into contacts (tenant_id, contact_kind, full_name)
     values ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'patient', 'Injected') $$,
  '42501', null, 'client A: cannot insert into tenant B' );
reset role;

-- =============================================================================
-- 3. Client B sees the mirror image -- proves the policy is not accidentally
--    keyed to "the first tenant".
-- =============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select is( (select full_name from contacts)::text, 'Patient B', 'client B: sees only their own patient' );
reset role;

-- =============================================================================
-- 4. Staff scoping. Role decides capability; tenant_scope decides visibility.
-- =============================================================================
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is( (select count(*) from tenants)::int, 1, 'assigned-scope staff: sees only assigned accounts' );
select is( (select count(*) from contacts)::int, 1, 'assigned-scope staff: cannot read unassigned tenant data' );
reset role;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
-- Scoped to the fixtures on purpose. An absolute count would also pick up the
-- seeded AgastyaOne tenant and make this test depend on seed state.
select is( (select count(*) from tenants where slug like 'test-clinic-%')::int, 2,
           'all-scope staff: sees both tenants, assigned or not' );
select ok( (select count(*) from tenants where slug = 'agastyaone') = 1,
           'all-scope staff: also sees the internal tenant' );
select is( (select count(*) from time_entries)::int, 1, 'all-scope staff: can read cost data' );
reset role;

select * from finish();
rollback;
