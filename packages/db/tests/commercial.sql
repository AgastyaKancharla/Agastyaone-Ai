-- =============================================================================
-- Commercial: reference/number assignment triggers, and a first isolation
-- pass on contracts/invoices.
--
-- contracts.reference (0034) and invoices.invoice_number (0035) share the
-- same shape: nullable, assigned exactly once by a trigger on the one status
-- transition that makes the document real, never reassigned after. Neither
-- had a dedicated test before this file -- schema_guards.sql's generic
-- shared_tables loop proves RLS is wired up structurally, but nothing
-- exercised the trigger logic itself or read the rows back as a client
-- would.
--
-- Same conventions as nap_compliance.sql: dependency-free, fully
-- transactional, roles simulated the way PostgREST does it.
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

insert into tenants (id, slug, name, vertical, status, place_of_supply) values
  ('aaaaaaaa-0000-4000-8000-000000000001','test-clinic-a','Test Clinic A','dental','active','29'),
  ('bbbbbbbb-0000-4000-8000-000000000002','test-clinic-b','Test Clinic B','dental','active','27');

insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001','all','active')
on conflict (profile_id) do update set tenant_scope = excluded.tenant_scope;

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','client_owner','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','44444444-0000-4000-8000-000000000004','client_owner','active');

-- ===========================================================================
-- 1. Contract reference: assigned once, on draft -> sent, never reassigned.
--    (0034 -- this is its first test.)
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into contracts (id, tenant_id, type, title, status) values
  ('c0000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','sow','Test SOW','draft');

select pg_temp.eq((select reference from contracts where id = 'c0000000-0000-4000-8000-000000000001'), null::text,
                  'contract: draft has no reference yet');

update contracts set status = 'sent' where id = 'c0000000-0000-4000-8000-000000000001';

select pg_temp.eq((select reference is not null from contracts where id = 'c0000000-0000-4000-8000-000000000001'), true,
                  'contract: reference assigned on draft -> sent');
select pg_temp.eq((select reference like 'CON/%' from contracts where id = 'c0000000-0000-4000-8000-000000000001'), true,
                  'contract: reference carries the CON prefix from next_reference');

create temp table _ref_capture (reference text) on commit drop;
insert into _ref_capture select reference from contracts where id = 'c0000000-0000-4000-8000-000000000001';

update contracts set status = 'signed' where id = 'c0000000-0000-4000-8000-000000000001';

select pg_temp.eq((select reference from contracts where id = 'c0000000-0000-4000-8000-000000000001'),
                  (select reference from _ref_capture),
                  'contract: reference is not reassigned on a later transition');

-- ===========================================================================
-- 2. Invoice number: nullable, two unnumbered drafts coexist under the same
--    issuer, a number is assigned once on draft -> issued alongside
--    issued_at, and neither is touched again by issued -> cancelled. (0035.)
-- ===========================================================================
insert into invoices (id, tenant_id, issuer_tenant_id, status, issue_date, supplier_state_code, place_of_supply, taxable_amount, total_amount) values
  ('10000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
   (select id from tenants where is_internal limit 1),'draft', current_date, '29', '29', 10000, 11800),
  ('10000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001',
   (select id from tenants where is_internal limit 1),'draft', current_date, '29', '29', 5000, 5900);

select pg_temp.eq((select invoice_number from invoices where id = '10000000-0000-4000-8000-000000000001'), null::text,
                  'invoice: draft has no number yet');
select pg_temp.eq(
  (select count(*)::int from invoices
    where issuer_tenant_id = (select id from tenants where is_internal limit 1) and invoice_number is null),
  2, 'invoice: two unnumbered drafts coexist under the same issuer -- no unique-index conflict');

update invoices set status = 'issued' where id = '10000000-0000-4000-8000-000000000001';

select pg_temp.eq((select invoice_number is not null from invoices where id = '10000000-0000-4000-8000-000000000001'), true,
                  'invoice: number assigned on draft -> issued');
select pg_temp.eq((select invoice_number like 'INV/%' from invoices where id = '10000000-0000-4000-8000-000000000001'), true,
                  'invoice: number carries the INV prefix');
select pg_temp.eq((select issued_at is not null from invoices where id = '10000000-0000-4000-8000-000000000001'), true,
                  'invoice: issued_at set in the same trigger');

create temp table _inv_capture (invoice_number text) on commit drop;
insert into _inv_capture select invoice_number from invoices where id = '10000000-0000-4000-8000-000000000001';

update invoices set status = 'cancelled' where id = '10000000-0000-4000-8000-000000000001';

select pg_temp.eq((select invoice_number from invoices where id = '10000000-0000-4000-8000-000000000001'),
                  (select invoice_number from _inv_capture),
                  'invoice: number is untouched by a later status change (issued -> cancelled)');
select pg_temp.eq((select status from invoices where id = '10000000-0000-4000-8000-000000000002'), 'draft',
                  'invoice: the other draft is unaffected by its sibling''s transition');

reset role;

-- ===========================================================================
-- 3. Payments recompute an invoice's amount_received/status from scratch on
--    every write, and credit notes get the same nullable/trigger-assigned
--    number as invoices and contracts. Neither trigger existed before 0036.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into invoices (id, tenant_id, issuer_tenant_id, status, issue_date, supplier_state_code, place_of_supply, taxable_amount, total_amount) values
  ('10000000-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001',
   (select id from tenants where is_internal limit 1),'draft', current_date, '29', '29', 10000, 10000);
update invoices set status = 'issued' where id = '10000000-0000-4000-8000-000000000003';

insert into payments (id, tenant_id, invoice_id, amount, received_on) values
  ('20000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', 4000, current_date);

select pg_temp.eq((select amount_received from invoices where id = '10000000-0000-4000-8000-000000000003'), 4000::numeric,
                  'payment: amount_received reflects a single partial payment');
select pg_temp.eq((select status from invoices where id = '10000000-0000-4000-8000-000000000003'), 'part_paid',
                  'payment: a partial payment moves the invoice to part_paid');

insert into payments (id, tenant_id, invoice_id, amount, received_on) values
  ('20000000-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', 6000, current_date);

select pg_temp.eq((select amount_received from invoices where id = '10000000-0000-4000-8000-000000000003'), 10000::numeric,
                  'payment: amount_received sums every payment, not just the latest');
select pg_temp.eq((select status from invoices where id = '10000000-0000-4000-8000-000000000003'), 'paid',
                  'payment: reaching the full total moves the invoice to paid');

delete from payments where id = '20000000-0000-4000-8000-000000000002';

select pg_temp.eq((select amount_received from invoices where id = '10000000-0000-4000-8000-000000000003'), 4000::numeric,
                  'payment: deleting a payment recomputes amount_received, not just decrements it');
select pg_temp.eq((select status from invoices where id = '10000000-0000-4000-8000-000000000003'), 'part_paid',
                  'payment: deleting the payment that completed it reverts the invoice to part_paid');

insert into credit_notes (id, tenant_id, issuer_tenant_id, invoice_id, reason, status, issue_date, taxable_amount, cgst_amount, sgst_amount, total_amount) values
  ('30000000-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001',
   (select id from tenants where is_internal limit 1), '10000000-0000-4000-8000-000000000003',
   'Test correction', 'draft', current_date, 2000, 180, 180, 2360);

select pg_temp.eq((select credit_note_number from credit_notes where id = '30000000-0000-4000-8000-000000000001'), null::text,
                  'credit note: draft has no number yet');

update credit_notes set status = 'issued' where id = '30000000-0000-4000-8000-000000000001';

select pg_temp.eq((select credit_note_number is not null from credit_notes where id = '30000000-0000-4000-8000-000000000001'), true,
                  'credit note: number assigned on draft -> issued');
select pg_temp.eq((select credit_note_number like 'CRE/%' from credit_notes where id = '30000000-0000-4000-8000-000000000001'), true,
                  'credit note: number carries the CRE prefix');
select pg_temp.eq((select issued_at is not null from credit_notes where id = '30000000-0000-4000-8000-000000000001'), true,
                  'credit note: issued_at set in the same trigger');

create temp table _cn_capture (credit_note_number text) on commit drop;
insert into _cn_capture select credit_note_number from credit_notes where id = '30000000-0000-4000-8000-000000000001';

update credit_notes set status = 'cancelled' where id = '30000000-0000-4000-8000-000000000001';

select pg_temp.eq((select credit_note_number from credit_notes where id = '30000000-0000-4000-8000-000000000001'),
                  (select credit_note_number from _cn_capture),
                  'credit note: number is untouched by a later status change (issued -> cancelled)');

reset role;

-- ===========================================================================
-- 4. Isolation: a client sees only their own clinic's contracts/invoices/
--    payments/credit notes. None of the four had a row-visibility test
--    before this file.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from contracts), 1, 'client A: sees their own clinic''s one contract');
select pg_temp.eq((select count(*)::int from invoices), 3, 'client A: sees their own clinic''s three invoices');
select pg_temp.eq((select count(*)::int from payments), 1, 'client A: sees their own clinic''s one remaining payment');
select pg_temp.eq((select count(*)::int from credit_notes), 1, 'client A: sees their own clinic''s one credit note');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from contracts), 0, 'client B: sees none of clinic A''s contracts');
select pg_temp.eq((select count(*)::int from invoices), 0, 'client B: sees none of clinic A''s invoices');
select pg_temp.eq((select count(*)::int from payments), 0, 'client B: sees none of clinic A''s payments');
select pg_temp.eq((select count(*)::int from credit_notes), 0, 'client B: sees none of clinic A''s credit notes');
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
    raise exception 'Commercial: % of % assertions FAILED', v_failed, (select count(*) from _assert);
  end if;
  raise notice 'Commercial: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
