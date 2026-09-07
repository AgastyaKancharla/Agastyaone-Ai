-- =============================================================================
-- 0003_commercial  (L1)
-- Service catalog, contracts, subscriptions, GST invoicing, entitlements.
--
-- GST notes that drive this design:
--  * Intra-state supply is CGST + SGST; inter-state is IGST. A single
--    tax_amount column cannot represent both and the split cannot be
--    reconstructed after the fact.
--  * Business clients deduct TDS, so payment received is less than invoice
--    total. Modelled explicitly or every reconciliation is wrong.
--  * An issued invoice is never edited; it is corrected with a credit note.
--  * Invoice numbers are gapless within a financial year (see
--    app.next_reference in 0002).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Catalog. The ten services are rows, not code. Bundles are rows in
-- service_components, so adding service eleven is an INSERT.
-- -----------------------------------------------------------------------------
create table service_catalog (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  name             text not null,
  category         text not null
                     check (category in ('presence','acquisition','engagement','operations','insight')),
  description      text,
  is_bundle        boolean not null default false,
  default_price    numeric(14,2),
  billing_cycle    text not null default 'monthly'
                     check (billing_cycle in ('one_time','monthly','quarterly','annual')),
  default_hsn_sac  text,
  default_gst_rate numeric(5,2) not null default 18.00,
  sort_order       integer not null default 0,
  status           text not null default 'active'
                     check (status in ('active','deprecated','draft')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index service_catalog_code_key on service_catalog (code);

create table service_components (
  parent_service_id uuid not null references service_catalog(id) on delete cascade,
  child_service_id  uuid not null references service_catalog(id) on delete cascade,
  sort_order        integer not null default 0,
  primary key (parent_service_id, child_service_id),
  check (parent_service_id <> child_service_id)
);

create table service_deliverables (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references service_catalog(id) on delete cascade,
  name        text not null,
  description text,
  cadence     text not null default 'monthly'
                check (cadence in ('once','weekly','monthly','quarterly','annual','on_demand')),
  sort_order  integer not null default 0
);
create index service_deliverables_service_idx on service_deliverables (service_id);

-- -----------------------------------------------------------------------------
-- Contracts. MSA -> SOW -> CR via parent_contract_id.
-- -----------------------------------------------------------------------------
create table contracts (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  parent_contract_id uuid references contracts(id) on delete set null,
  reference         text,
  type              text not null default 'sow'
                      check (type in ('msa','sow','change_request')),
  title             text not null,
  commercial_model  text not null default 'retainer'
                      check (commercial_model in ('retainer','fixed_price','time_and_materials','outcome')),
  status            text not null default 'draft'
                      check (status in ('draft','sent','signed','active','completed','terminated')),
  currency_code     text not null default 'INR',
  total_value       numeric(14,2),
  starts_on         date,
  ends_on           date,
  signed_at         timestamptz,
  document_id       uuid references documents(id) on delete set null,
  approved_by       uuid references profiles(id) on delete set null,
  approved_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index contracts_tenant_status_idx on contracts (tenant_id, status);
create unique index contracts_reference_key on contracts (reference) where reference is not null;

create table contract_lines (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  contract_id   uuid not null references contracts(id) on delete cascade,
  service_id    uuid not null references service_catalog(id),
  description   text,
  hsn_sac_code  text,
  quantity      numeric(10,2) not null default 1,
  unit_price    numeric(14,2) not null default 0,
  discount_pct  numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  gst_rate      numeric(5,2) not null default 18.00,
  billing_cycle text not null default 'monthly'
                  check (billing_cycle in ('one_time','monthly','quarterly','annual')),
  starts_on     date,
  ends_on       date,
  status        text not null default 'active'
                  check (status in ('active','paused','ended')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index contract_lines_contract_idx on contract_lines (contract_id);
create index contract_lines_tenant_service_idx on contract_lines (tenant_id, service_id) where status = 'active';

-- A subscription is a billing schedule on a contract line, not a parent of
-- delivery. Delivery hangs off service_instances (0005).
create table subscriptions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  contract_line_id  uuid not null references contract_lines(id) on delete cascade,
  status            text not null default 'active'
                      check (status in ('trial','active','paused','cancelled','expired')),
  mrr               numeric(14,2) not null default 0,
  billing_cycle     text not null default 'monthly'
                      check (billing_cycle in ('one_time','monthly','quarterly','annual')),
  started_on        date not null default current_date,
  next_invoice_on   date,
  renews_on         date,
  cancelled_at      timestamptz,
  cancellation_reason text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index subscriptions_tenant_status_idx on subscriptions (tenant_id, status);
create index subscriptions_next_invoice_idx on subscriptions (next_invoice_on)
  where status in ('active','trial');

-- -----------------------------------------------------------------------------
-- Invoicing
-- -----------------------------------------------------------------------------
create table invoices (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  issuer_tenant_id    uuid not null references tenants(id),
  contract_id         uuid references contracts(id) on delete set null,
  invoice_number      text not null,
  status              text not null default 'draft'
                        check (status in ('draft','issued','part_paid','paid','cancelled','written_off')),
  issue_date          date not null default current_date,
  due_date            date,
  currency_code       text not null default 'INR',

  -- Tax geography. Both sides captured on the invoice so a later change to
  -- either party's registration cannot rewrite issued history.
  supplier_state_code text not null,
  place_of_supply     text not null,
  is_interstate       boolean not null generated always as (supplier_state_code <> place_of_supply) stored,
  supplier_gstin      text,
  customer_gstin      text,

  taxable_amount      numeric(14,2) not null default 0,
  discount_amount     numeric(14,2) not null default 0,
  cgst_amount         numeric(14,2) not null default 0,
  sgst_amount         numeric(14,2) not null default 0,
  igst_amount         numeric(14,2) not null default 0,
  total_tax           numeric(14,2) not null default 0,
  round_off           numeric(14,2) not null default 0,
  total_amount        numeric(14,2) not null default 0,

  -- Clients deduct TDS at source, so expected receipt is total - tds.
  tds_amount          numeric(14,2) not null default 0,
  amount_received     numeric(14,2) not null default 0,

  notes               text,
  document_id         uuid references documents(id) on delete set null,
  issued_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Either CGST+SGST or IGST, never both.
  constraint invoices_tax_split_ck check (
    (is_interstate and cgst_amount = 0 and sgst_amount = 0)
    or ((not is_interstate) and igst_amount = 0)
  )
);
create unique index invoices_number_key on invoices (issuer_tenant_id, invoice_number);
create index invoices_tenant_status_idx on invoices (tenant_id, status, issue_date desc);
create index invoices_outstanding_idx on invoices (tenant_id, due_date)
  where status in ('issued','part_paid');

create table invoice_lines (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  invoice_id     uuid not null references invoices(id) on delete cascade,
  service_id     uuid references service_catalog(id),
  subscription_id uuid references subscriptions(id) on delete set null,
  description    text not null,
  hsn_sac_code   text,
  quantity       numeric(10,2) not null default 1,
  unit_price     numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  taxable_amount numeric(14,2) not null default 0,
  gst_rate       numeric(5,2) not null default 18.00,
  cgst_amount    numeric(14,2) not null default 0,
  sgst_amount    numeric(14,2) not null default 0,
  igst_amount    numeric(14,2) not null default 0,
  line_total     numeric(14,2) not null default 0,
  period_start   date,
  period_end     date,
  sort_order     integer not null default 0
);
create index invoice_lines_invoice_idx on invoice_lines (invoice_id, sort_order);

-- Issued invoices are corrected with a credit note, never edited.
create table credit_notes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  issuer_tenant_id uuid not null references tenants(id),
  invoice_id      uuid not null references invoices(id),
  credit_note_number text not null,
  reason          text not null,
  status          text not null default 'draft'
                    check (status in ('draft','issued','cancelled')),
  issue_date      date not null default current_date,
  taxable_amount  numeric(14,2) not null default 0,
  cgst_amount     numeric(14,2) not null default 0,
  sgst_amount     numeric(14,2) not null default 0,
  igst_amount     numeric(14,2) not null default 0,
  total_amount    numeric(14,2) not null default 0,
  document_id     uuid references documents(id) on delete set null,
  issued_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index credit_notes_number_key on credit_notes (issuer_tenant_id, credit_note_number);
create index credit_notes_invoice_idx on credit_notes (invoice_id);

create table payments (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  invoice_id           uuid references invoices(id) on delete set null,
  amount               numeric(14,2) not null,
  tds_amount           numeric(14,2) not null default 0,
  tds_certificate_ref  text,
  method               text not null default 'upi'
                         check (method in ('upi','bank_transfer','cash','cheque','card','other')),
  reference            text,
  received_on          date not null default current_date,
  notes                text,
  recorded_by          uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index payments_tenant_idx on payments (tenant_id, received_on desc);
create index payments_invoice_idx on payments (invoice_id);

-- -----------------------------------------------------------------------------
-- Entitlements: a flat projection, maintained by trigger, so "is this module
-- on?" is one index probe rather than a recursive CTE on every page load.
--
-- Deliberately NOT used in RLS policies. Tenancy is a security concern;
-- entitlement is a product concern. Conflating them means a lapsed
-- subscription makes a client's own historical data disappear.
-- -----------------------------------------------------------------------------
create table tenant_entitlements (
  tenant_id    uuid not null references tenants(id) on delete cascade,
  service_code text not null,
  state        text not null default 'active'
                 check (state in ('active','trial','suspended','pending_activation')),
  source       text not null
                 check (source in ('contract_line','bundle','comp','override')),
  source_id    uuid,
  valid_from   date not null default current_date,
  valid_to     date,
  updated_at   timestamptz not null default now(),
  primary key (tenant_id, service_code)
);

-- Recompute from contract lines, expanding bundles one level (the catalog has
-- no nested bundles; a CHECK on service_components prevents self-reference and
-- seeds keep depth at one).
create or replace function app.rebuild_tenant_entitlements(p_tenant_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  delete from public.tenant_entitlements
   where tenant_id = p_tenant_id and source in ('contract_line','bundle');

  insert into public.tenant_entitlements
    (tenant_id, service_code, state, source, source_id, valid_from, valid_to)
  -- DISTINCT ON matters: a service can be both a directly-sold line and a
  -- child of a bundle the same tenant bought. Without it the INSERT tries to
  -- affect one (tenant_id, service_code) row twice and ON CONFLICT errors.
  -- Direct contract lines win over bundle inheritance.
  select distinct on (sc.code)
    p_tenant_id,
    sc.code,
    'active',
    case when cl.service_id = sc.id then 'contract_line' else 'bundle' end,
    cl.id,
    coalesce(cl.starts_on, current_date),
    cl.ends_on
  from public.contract_lines cl
  join public.contracts c on c.id = cl.contract_id
  -- the line's own service, plus any children if it is a bundle
  join public.service_catalog sc
    on sc.id = cl.service_id
    or sc.id in (
      select comp.child_service_id
      from public.service_components comp
      where comp.parent_service_id = cl.service_id
    )
  where cl.tenant_id = p_tenant_id
    and cl.status = 'active'
    and c.status in ('signed','active')
  order by sc.code, (case when cl.service_id = sc.id then 0 else 1 end), cl.created_at
  on conflict (tenant_id, service_code) do update
    set state      = excluded.state,
        source     = excluded.source,
        source_id  = excluded.source_id,
        valid_from = least(public.tenant_entitlements.valid_from, excluded.valid_from),
        valid_to   = excluded.valid_to,
        updated_at = now();
end;
$$;

create or replace function app.contract_lines_entitlement_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.rebuild_tenant_entitlements(coalesce(new.tenant_id, old.tenant_id));
  return coalesce(new, old);
end;
$$;

create trigger contract_lines_entitlements
  after insert or update or delete on contract_lines
  for each row execute function app.contract_lines_entitlement_trigger();

create or replace function app.contracts_entitlement_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.rebuild_tenant_entitlements(new.tenant_id);
  return new;
end;
$$;

create trigger contracts_entitlements
  after update of status on contracts
  for each row execute function app.contracts_entitlement_trigger();

-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'service_catalog','contracts','contract_lines','subscriptions',
    'invoices','credit_notes','payments'
  ] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function app.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
