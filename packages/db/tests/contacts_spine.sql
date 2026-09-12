-- =============================================================================
-- Contacts spine suite
--
-- `contacts` is the spine every remaining service line hangs off. Ten services
-- will depend on identity resolution behaving exactly one way, so the rules are
-- pinned here before the second service is built rather than discovered later
-- with production data on top of them.
--
-- What it asserts:
--   * three spellings of one Indian mobile number converge on ONE contact
--   * the same number in two tenants stays TWO contacts (a shared identity
--     graph across clinics would be a DPDP incident, not a feature)
--   * a dry run writes nothing
--   * re-importing a file is a no-op, not a duplicate factory
--   * unusable rows are reported, never silently dropped
--   * every entry point re-checks tenancy, so a forged tenant id is refused by
--     the database rather than by the caller
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
-- Fixtures. Same shape as the isolation suite: one all-scope staff member, one
-- assigned to tenant A only, and one client of tenant A.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-all@test.local'),
  ('22222222-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-assigned@test.local'),
  ('33333333-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.local');

insert into profiles (id, email, full_name, user_type) values
  ('11111111-0000-4000-8000-000000000001','staff-all@test.local','Staff All','staff'),
  ('22222222-0000-4000-8000-000000000002','staff-assigned@test.local','Staff Assigned','staff'),
  ('33333333-0000-4000-8000-000000000003','client-a@test.local','Client A','client')
on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;

insert into tenants (id, slug, name, vertical, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','spine-clinic-a','Spine Clinic A','dental','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','spine-clinic-b','Spine Clinic B','dental','active');

insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001','all','active'),
  ('22222222-0000-4000-8000-000000000002','assigned','active')
on conflict (profile_id) do update set tenant_scope = excluded.tenant_scope;

insert into account_assignments (tenant_id, staff_id, role, status)
select 'aaaaaaaa-0000-4000-8000-000000000001', s.id, 'specialist', 'active'
from staff_members s where s.profile_id = '22222222-0000-4000-8000-000000000002';

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','client_owner','active');

insert into tenant_locations (id, tenant_id, name, city, state_code, is_primary) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Spine A - Koramangala','Bengaluru','29',true),
  ('dddddddd-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','Spine B - Indiranagar','Bengaluru','29',true);


-- ===========================================================================
-- 1. Normalisation. The reason this lives in Postgres and not in TypeScript:
--    one import script that skips it creates a permanent duplicate.
-- ===========================================================================
select pg_temp.eq(app.normalize_phone_e164('+91 98765 43210'), '+919876543210', 'normalise: international with spaces');
select pg_temp.eq(app.normalize_phone_e164('09876543210'),     '+919876543210', 'normalise: Indian trunk prefix');
select pg_temp.eq(app.normalize_phone_e164('9876543210'),      '+919876543210', 'normalise: bare 10 digits');
select pg_temp.eq(app.normalize_phone_e164('919876543210'),    '+919876543210', 'normalise: country code, no plus');
select pg_temp.eq(app.normalize_phone_e164('not a phone'),     null,            'normalise: rubbish is null, not garbage');
select pg_temp.eq(app.normalize_identity('email', '  Agastya@AgastyaOne.COM '), 'agastya@agastyaone.com', 'normalise: email is trimmed and lowered');


-- ===========================================================================
-- 2. The private helper is not reachable by a logged-in user.
--    It takes p_tenant_id as an argument and does NOT check accessibility, so
--    the grant is the only thing standing between it and a cross-tenant write.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select app.resolve_contact('bbbbbbbb-0000-4000-8000-000000000002'::uuid,'phone_e164','9000000001')$q$,
  'app.resolve_contact: not executable by authenticated');
reset role;

set local role anon;
select pg_temp.denied(
  $q$select app.resolve_contact('bbbbbbbb-0000-4000-8000-000000000002'::uuid,'phone_e164','9000000002')$q$,
  'app.resolve_contact: not executable by anon');
reset role;


-- ===========================================================================
-- 3. Three spellings, one patient. The whole point of the spine.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- 3a. A dry run reports what WOULD happen and writes nothing.
select pg_temp.eq(
  (public.import_contacts(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"full_name":"Kruthika R","phone":"+91 98765 43210"},
       {"full_name":"Kruthika R","phone":"09876543210"},
       {"full_name":"Kruthika R","phone":"9876543210"}]'::jsonb,
     null, true) ->> 'created')::int,
  1, 'dry run: reports 1 created from 3 spellings');

select pg_temp.eq((select count(*) from contacts where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
                  0, 'dry run: wrote nothing');

-- 3b. The real import.
select pg_temp.eq(
  (public.import_contacts(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"full_name":"Kruthika R","phone":"+91 98765 43210"},
       {"full_name":"Kruthika R","phone":"09876543210"},
       {"full_name":"Kruthika R","phone":"9876543210"}]'::jsonb,
     'cccccccc-0000-4000-8000-000000000001', false) ->> 'matched')::int,
  2, 'import: 2 of 3 rows recognised as the same person');

select pg_temp.eq((select count(*) from contacts where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
                  1, 'import: three spellings produced ONE contact');
select pg_temp.eq((select primary_phone_e164 from contacts where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
                  '+919876543210', 'import: stored in E.164');
select pg_temp.eq((select consent_source from contacts where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
                  'import', 'import: consent provenance recorded, not left null');

-- 3c. Re-running the same file changes nothing. An import that is not
--     idempotent cannot be re-run after a partial failure.
select pg_temp.eq(
  (public.import_contacts(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"full_name":"Kruthika R","phone":"+91 98765 43210"},
       {"full_name":"Kruthika R","phone":"09876543210"},
       {"full_name":"Kruthika R","phone":"9876543210"}]'::jsonb,
     null, false) ->> 'created')::int,
  0, 're-import: nothing created the second time');
select pg_temp.eq((select count(*) from contacts where tenant_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
                  1, 're-import: still ONE contact');


-- ===========================================================================
-- 4. Unusable rows are counted and explained, never silently dropped.
--    A clinic that imports 400 patients and gets 380 must be told which 20.
-- ===========================================================================
select pg_temp.eq(
  (public.import_contacts(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"full_name":"No Contact Details"},
       {"full_name":"Also Nothing","phone":"","email":""}]'::jsonb,
     null, false) ->> 'skipped')::int,
  2, 'import: rows with no usable identity are skipped');

select pg_temp.eq(
  jsonb_array_length(
    public.import_contacts(
      'aaaaaaaa-0000-4000-8000-000000000001',
      '[{"full_name":"No Contact Details"}]'::jsonb, null, true) -> 'errors'),
  1, 'import: and each skip is reported with its reason');


-- ===========================================================================
-- 5. Email as the identity, and a second identity attached to one contact.
-- ===========================================================================
select public.import_contacts(
  'aaaaaaaa-0000-4000-8000-000000000001',
  '[{"full_name":"Arjun M","phone":"9812345678","email":"arjun@example.com"}]'::jsonb,
  null, false);

select pg_temp.eq(
  (select count(*) from contact_identities ci
    join contacts c on c.id = ci.contact_id
   where c.full_name = 'Arjun M')::int,
  2, 'import: phone and email both attached to the one contact');

-- The email alone now resolves to that same contact rather than making a new one.
select pg_temp.eq(
  (public.import_contacts(
     'aaaaaaaa-0000-4000-8000-000000000001',
     '[{"full_name":"Arjun M","email":"ARJUN@example.com"}]'::jsonb, null, true) ->> 'matched')::int,
  1, 'import: email alone matches the existing contact, case-insensitively');


-- ===========================================================================
-- 6. Tenancy. Every entry point re-checks it server-side, so a forged id in a
--    form post is refused by the database and not by the caller.
-- ===========================================================================
-- All-scope staff may write into either tenant.
select pg_temp.eq(
  (public.import_contacts('bbbbbbbb-0000-4000-8000-000000000002',
     '[{"full_name":"Patient B","phone":"9876543210"}]'::jsonb, null, false) ->> 'created')::int,
  1, 'all-scope staff: may import into tenant B');

-- ...and the SAME number in tenant B is a DIFFERENT person. Identities are
-- scoped per tenant on purpose: two clinics can legitimately share a patient.
select pg_temp.eq((select count(*) from contacts where primary_phone_e164 = '+919876543210')::int,
                  2, 'cross-tenant: one number, two tenants, two contacts');
reset role;

-- Assigned-scope staff are confined to tenant A.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-0000-4000-8000-000000000002","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select public.create_contact('bbbbbbbb-0000-4000-8000-000000000002'::uuid,'Forged','9000000003')$q$,
  'assigned staff: create_contact refused for an unassigned tenant');
select pg_temp.denied(
  $q$select public.import_contacts('bbbbbbbb-0000-4000-8000-000000000002'::uuid,
       '[{"full_name":"Forged","phone":"9000000004"}]'::jsonb)$q$,
  'assigned staff: import_contacts refused for an unassigned tenant');
select pg_temp.eq(
  (public.import_contacts('aaaaaaaa-0000-4000-8000-000000000001',
     '[{"full_name":"Legit","phone":"9000000005"}]'::jsonb, null, true) ->> 'created')::int,
  1, 'assigned staff: allowed for their own assigned tenant');
reset role;

-- A client cannot create contacts at all, not even in their own tenant.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select public.create_contact('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'By client','9000000006')$q$,
  'client: create_contact refused even in their own tenant');
select pg_temp.denied(
  $q$select public.import_contacts('aaaaaaaa-0000-4000-8000-000000000001'::uuid,
       '[{"full_name":"By client","phone":"9000000007"}]'::jsonb)$q$,
  'client: import_contacts refused even in their own tenant');
reset role;

-- A location belonging to another tenant is refused even for all-scope staff,
-- since it would file tenant B's branch against tenant A's patient.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select public.import_contacts('aaaaaaaa-0000-4000-8000-000000000001'::uuid,
       '[{"full_name":"Wrong branch","phone":"9000000008"}]'::jsonb,
       'dddddddd-0000-4000-8000-000000000002'::uuid)$q$,
  'import: location from another tenant is refused');
reset role;


-- ===========================================================================
-- 7. Consent is writable only through the one function that demands a source.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

select public.set_contact_consent(
  (select id from contacts where full_name = 'Arjun M'),
  'whatsapp', true, 'in_clinic', '{"captured_by":"front desk"}'::jsonb);

select pg_temp.eq(
  (select whatsapp_opt_in_at is not null and whatsapp_opt_out_at is null
     from contacts where full_name = 'Arjun M'),
  true, 'consent: opting in sets the timestamp and clears any opt-out');

select public.set_contact_consent(
  (select id from contacts where full_name = 'Arjun M'), 'whatsapp', false, 'phone_call');

select pg_temp.eq(
  (select whatsapp_opt_out_at is not null from contacts where full_name = 'Arjun M'),
  true, 'consent: opting out is recorded rather than erasing the opt-in');

select pg_temp.denied(
  $q$select public.set_contact_consent(
       (select id from contacts where full_name = 'Arjun M'), 'carrier_pigeon', true)$q$,
  'consent: an unknown channel is refused');
reset role;


-- ---------------------------------------------------------------------------
-- Report
-- ---------------------------------------------------------------------------
select n, case when ok then 'ok' else 'FAIL' end as status, name, detail
from _assert order by n;

do $$
declare
  v_failed integer;
  v_total  integer;
begin
  select count(*) filter (where not ok), count(*) into v_failed, v_total from _assert;
  if v_failed > 0 then
    raise exception 'Contacts spine: % of % assertions FAILED', v_failed, v_total;
  end if;
  raise notice 'Contacts spine: all % assertions passed', v_total;
end;
$$;

rollback;
