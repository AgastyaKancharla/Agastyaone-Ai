-- =============================================================================
-- Review runtime suite
--
-- Pins the two rules that make this service line defensible rather than merely
-- functional:
--
--   1. THE CONSENT GATE. A patient can be handed a QR code without opting in to
--      anything, because handing someone a code is not messaging them. Every
--      other channel is refused until a live opt-in for THAT channel exists.
--      Written while the only shipping channel is the ungated one, so the check
--      is already standing when WhatsApp arrives.
--
--   2. THE ANON EXCEPTION. `anon` holds no privilege on any table, and exactly
--      one function is granted to it. These assertions are what keep that "one"
--      honest — that it returns nothing but a URL, cannot be used to enumerate,
--      and cannot be replayed to inflate a clinic's numbers.
--
-- Dependency-free and fully transactional, like the other two suites.
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
-- Fixtures: two tenants, one all-scope staff member, one client of tenant A.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-all@test.local'),
  ('33333333-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.local');

insert into profiles (id, email, full_name, user_type) values
  ('11111111-0000-4000-8000-000000000001','staff-all@test.local','Staff All','staff'),
  ('33333333-0000-4000-8000-000000000003','client-a@test.local','Client A','client')
on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;

insert into tenants (id, slug, name, vertical, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','rev-clinic-a','Review Clinic A','dental','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','rev-clinic-b','Review Clinic B','dental','active');

insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001','all','active')
on conflict (profile_id) do update set tenant_scope = 'all';

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','client_owner','active');

insert into tenant_locations (id, tenant_id, name, city, state_code, is_primary) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Review A - Koramangala','Bengaluru','29',true),
  ('dddddddd-0000-4000-8000-000000000002','bbbbbbbb-0000-4000-8000-000000000002','Review B - Indiranagar','Bengaluru','29',true);

-- Two patients in tenant A: one imported (no consent to message), one who
-- opted in at the desk. And one patient in tenant B, for the cross-tenant test.
insert into contacts (id, tenant_id, location_id, contact_kind, full_name, primary_phone_raw, consent_source) values
  ('ee000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','patient','Imported Patient','9811111111','import'),
  ('ee000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','patient','Opted In Patient','9822222222','in_clinic'),
  ('ee000000-0000-4000-8000-000000000003','bbbbbbbb-0000-4000-8000-000000000002','dddddddd-0000-4000-8000-000000000002','patient','Other Clinic Patient','9833333333','in_clinic');


-- ===========================================================================
-- 1. Connecting a review source.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

select pg_temp.eq(
  public.create_review_source('cccccccc-0000-4000-8000-000000000001',
                              'google',
                              'https://maps.google.com/?cid=clinic-a',
                              'ChIJ_test_place_id_A') is not null,
  true, 'source: staff can connect a Google listing');

-- Upsert, not duplicate: the unique key is (location_id, platform).
select public.create_review_source('cccccccc-0000-4000-8000-000000000001', 'google',
                                   'https://maps.google.com/?cid=clinic-a-corrected', null);
select pg_temp.eq((select count(*) from review_sources
                    where location_id = 'cccccccc-0000-4000-8000-000000000001')::int,
                  1, 'source: reconnecting updates rather than duplicating');
select pg_temp.eq((select profile_url from review_sources
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'),
                  'https://maps.google.com/?cid=clinic-a-corrected',
                  'source: the corrected URL wins');
-- ...and a null on a later call must not wipe a value that was already set.
select pg_temp.eq((select external_id from review_sources
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'),
                  'ChIJ_test_place_id_A',
                  'source: an omitted place id does not erase the stored one');

select pg_temp.denied(
  $q$select public.create_review_source('cccccccc-0000-4000-8000-000000000001'::uuid, 'yelp', 'https://x')$q$,
  'source: an unsupported platform is refused');
select pg_temp.denied(
  $q$select public.create_review_source('cccccccc-0000-4000-8000-000000000001'::uuid, 'google')$q$,
  'source: neither URL nor place id is refused');

-- Tenant B gets its own source, used below to prove sources cannot be crossed.
select public.create_review_source('dddddddd-0000-4000-8000-000000000002', 'google',
                                   'https://maps.google.com/?cid=clinic-b', 'ChIJ_test_place_id_B');
reset role;

-- A client cannot connect or change a source, even for their own clinic.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select public.create_review_source('cccccccc-0000-4000-8000-000000000001'::uuid,'google','https://evil')$q$,
  'source: a client cannot connect one');
reset role;


-- ===========================================================================
-- 2. THE CONSENT GATE.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- An imported patient has provenance for the ROW, not permission to be messaged.
select pg_temp.denied(
  format($q$select public.issue_review_request('ee000000-0000-4000-8000-000000000001'::uuid, %L::uuid, 'whatsapp')$q$,
         (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001')),
  'consent: WhatsApp refused for an imported contact with no opt-in');
select pg_temp.denied(
  format($q$select public.issue_review_request('ee000000-0000-4000-8000-000000000001'::uuid, %L::uuid, 'sms')$q$,
         (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001')),
  'consent: SMS refused too');

-- ...but a QR code is fine, because nobody is being messaged.
select pg_temp.eq(
  (select (public.issue_review_request('ee000000-0000-4000-8000-000000000001',
            (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001'),
            'link') ->> 'status')),
  'sent', 'consent: a link needs no opt-in — it is not messaging');

-- Opt in at the desk, and WhatsApp becomes available.
select public.set_contact_consent('ee000000-0000-4000-8000-000000000002','whatsapp', true, 'in_clinic');
select pg_temp.eq(
  (select (public.issue_review_request('ee000000-0000-4000-8000-000000000002',
            (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001'),
            'whatsapp') ->> 'status')),
  'pending', 'consent: with an opt-in, WhatsApp is allowed and waits for a sender');

-- Opt out, and it closes again. An opt-out must beat an earlier opt-in.
select public.set_contact_consent('ee000000-0000-4000-8000-000000000002','whatsapp', false, 'phone_call');
select pg_temp.denied(
  format($q$select public.issue_review_request('ee000000-0000-4000-8000-000000000002'::uuid, %L::uuid, 'whatsapp')$q$,
         (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001')),
  'consent: an opt-out closes the channel again');

-- A contact from another clinic cannot be pointed at this clinic's listing.
select pg_temp.denied(
  format($q$select public.issue_review_request('ee000000-0000-4000-8000-000000000003'::uuid, %L::uuid, 'link')$q$,
         (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001')),
  'tenancy: a source from another tenant is refused');
reset role;

-- A client cannot issue requests for their own patients.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  format($q$select public.issue_review_request('ee000000-0000-4000-8000-000000000001'::uuid, %L::uuid, 'link')$q$,
         (select id from review_sources where location_id = 'cccccccc-0000-4000-8000-000000000001')),
  'consent: a client cannot issue requests');
reset role;


-- ===========================================================================
-- 3. THE ANON EXCEPTION — the scan path.
-- ===========================================================================

-- anon still cannot touch a single table. The function grant is an exception to
-- the function, not a crack in the wall.
set local role anon;
select pg_temp.denied('select count(*) from review_requests', 'anon: still refused on review_requests');
select pg_temp.denied('select count(*) from contacts',        'anon: still refused on contacts');
select pg_temp.denied('select count(*) from review_sources',  'anon: still refused on review_sources');

-- An unknown or malformed token returns null rather than raising, so the
-- endpoint cannot be used to learn which tokens exist.
select pg_temp.eq(public.record_review_click('not-a-token'), null, 'anon: a malformed token returns null');
select pg_temp.eq(public.record_review_click(repeat('a', 32)), null, 'anon: an unknown token returns null');
select pg_temp.eq(public.record_review_click(null), null, 'anon: a null token returns null');
reset role;

-- The real scan, performed as anon exactly as a patient's phone would.
-- The token is captured BEFORE switching role: anon cannot read the table it
-- lives in, which is the point of the exception being one function wide.
create temp table _tok on commit drop as
  select public_token from public.review_requests where channel = 'link' limit 1;
grant select on _tok to public;

set local role anon;
select pg_temp.eq(
  public.record_review_click((select public_token from _tok)),
  'https://maps.google.com/?cid=clinic-a-corrected',
  'anon: a real token returns the destination');
reset role;

select pg_temp.eq(
  (select status from review_requests where channel = 'link' limit 1),
  'clicked', 'scan: the request moved to clicked');
select pg_temp.eq(
  (select clicked_at is not null from review_requests where channel = 'link' limit 1),
  true, 'scan: clicked_at was set');

-- A QR scanned twice at the desk must not inflate the funnel the clinic sees.
do $$
declare
  v_token text;
  v_first timestamptz;
begin
  select public_token, clicked_at into v_token, v_first
  from public.review_requests where channel = 'link' limit 1;

  perform pg_sleep(0.01);
  set local role anon;
  perform public.record_review_click(v_token);
  reset role;

  insert into _assert (ok, name, detail)
  select clicked_at = v_first, 'scan: a second scan does not move clicked_at',
         case when clicked_at = v_first then '' else 'timestamp moved' end
  from public.review_requests where public_token = v_token;
end;
$$;


-- ===========================================================================
-- 4. Nothing from Google is stored. The terms compliance is a test, not a
--    comment: `reviews` must still be empty after the whole flow above.
-- ===========================================================================
select pg_temp.eq((select count(*) from reviews)::int, 0,
                  'terms: no Places data was written to reviews');


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
    raise exception 'Review runtime: % of % assertions FAILED', v_failed, v_total;
  end if;
  raise notice 'Review runtime: all % assertions passed', v_total;
end;
$$;

rollback;
