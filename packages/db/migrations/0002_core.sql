-- =============================================================================
-- 0002_core  (L0)
-- Identity, RBAC, tenancy, locations, documents, and the shared infrastructure
-- tables (reference sequences, idempotency, calendars, DPAs).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profiles: one row per auth.users row, for both staff and client users.
-- -----------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        citext not null,
  full_name    text   not null default '',
  phone_e164   text,
  avatar_url   text,
  user_type    text   not null default 'client'
                 check (user_type in ('staff','client')),
  status       text   not null default 'active'
                 check (status in ('active','suspended','deactivated')),
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index profiles_email_key on profiles (email);

-- -----------------------------------------------------------------------------
-- Tenants. AgastyaOne itself is tenant #1 (is_internal), which is what removes
-- the need for a separate sales-CRM and exercises multi-tenancy every day.
-- -----------------------------------------------------------------------------
create table tenants (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null,
  name             text not null,
  legal_name       text,
  is_internal      boolean not null default false,
  vertical         text not null default 'dental'
                     check (vertical in ('dental','clinic','retail','services','other')),
  status           text not null default 'prospect'
                     check (status in ('prospect','onboarding','active','paused','churned')),
  health_status    text not null default 'unknown'
                     check (health_status in ('unknown','green','amber','red')),
  -- GST identity. place_of_supply is the 2-digit GST state code ('29' =
  -- Karnataka) and decides CGST+SGST vs IGST on every invoice. It cannot be
  -- reconstructed after the fact, so it is captured on the tenant, not the
  -- invoice.
  gstin            text check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'),
  pan              text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  place_of_supply  text check (place_of_supply is null or place_of_supply ~ '^[0-9]{2}$'),
  billing_email    citext,
  onboarded_at     timestamptz,
  churned_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index tenants_slug_key on tenants (slug);
create index tenants_status_idx on tenants (status) where status in ('active','onboarding');

-- Exactly one internal tenant.
create unique index tenants_single_internal_idx on tenants (is_internal) where is_internal;

-- -----------------------------------------------------------------------------
-- Locations. NAP, GBP, call tracking, reviews and bookings are all per-branch;
-- every runtime table carries location_id for this reason.
-- -----------------------------------------------------------------------------
create table tenant_locations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  name           text not null,
  is_primary     boolean not null default false,
  address_line1  text,
  address_line2  text,
  locality       text,
  city           text,
  state          text,
  state_code     text check (state_code is null or state_code ~ '^[0-9]{2}$'),
  pincode        text,
  country        text not null default 'IN',
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  phone_e164     text,
  timezone       text not null default 'Asia/Kolkata',
  gbp_place_id   text,
  status         text not null default 'active'
                   check (status in ('active','closed','temporarily_closed')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tenant_locations_tenant_idx on tenant_locations (tenant_id, status);
create unique index tenant_locations_primary_idx
  on tenant_locations (tenant_id) where is_primary;

-- -----------------------------------------------------------------------------
-- Staff and RBAC.
--
-- tenant_scope is the visibility axis, roles are the capability axis. They are
-- deliberately separate: the first contractor you hire needs full capability on
-- one account, not read access to every client's patient data.
-- -----------------------------------------------------------------------------
create table staff_members (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  employee_code text,
  job_title     text,
  department    text,
  manager_id    uuid references staff_members(id) on delete set null,
  tenant_scope  text not null default 'assigned'
                  check (tenant_scope in ('all','assigned','none')),
  capacity_hours_per_week numeric(5,2) not null default 40,
  hourly_cost   numeric(14,2),
  status        text not null default 'active'
                  check (status in ('active','on_leave','offboarded')),
  joined_at     date,
  offboarded_at date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index staff_members_profile_key on staff_members (profile_id);
create unique index staff_members_code_key on staff_members (employee_code)
  where employee_code is not null;

create table roles (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  description text,
  scope       text not null default 'staff' check (scope in ('staff','client')),
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index roles_code_key on roles (code);

create table permissions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  description text,
  category    text
);
create unique index permissions_code_key on permissions (code);

create table role_permissions (
  role_id       uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table user_roles (
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references profiles(id) on delete set null,
  primary key (profile_id, role_id)
);

-- Client users. A user may belong to more than one tenant.
create table memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role       text not null default 'client_member'
               check (role in ('client_owner','client_manager','client_member')),
  status     text not null default 'active'
               check (status in ('invited','active','suspended','removed')),
  invited_at timestamptz,
  joined_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index memberships_tenant_profile_key on memberships (tenant_id, profile_id);
create index memberships_profile_active_idx on memberships (profile_id) where status = 'active';

-- Which staff see which accounts.
create table account_assignments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  staff_id    uuid not null references staff_members(id) on delete cascade,
  role        text not null default 'specialist'
                check (role in ('account_manager','delivery_lead','specialist','observer')),
  status      text not null default 'active'
                check (status in ('active','ended')),
  assigned_at timestamptz not null default now(),
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index account_assignments_key on account_assignments (tenant_id, staff_id, role);
create index account_assignments_staff_active_idx on account_assignments (staff_id) where status = 'active';

-- -----------------------------------------------------------------------------
-- Audit log. Append-only, never deleted. An `all`-scope staff member reading
-- outside their assignments writes a row here -- the difference between "we
-- trust our staff" and being able to show a client who accessed their data.
-- -----------------------------------------------------------------------------
create table audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid references tenants(id) on delete set null,
  actor_id    uuid references profiles(id) on delete set null,
  actor_email citext,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  reason      text,
  ip_address  inet,
  user_agent  text,
  occurred_at timestamptz not null default now()
);
create index audit_log_tenant_time_idx on audit_log (tenant_id, occurred_at desc);
create index audit_log_actor_time_idx  on audit_log (actor_id, occurred_at desc);
create index audit_log_entity_idx      on audit_log (entity_type, entity_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Settings and flags.
--
-- feature_flags is deliberately a separate table from tenant_entitlements: put
-- them together and a rollout flag will one day switch off a paying client's
-- module.
-- -----------------------------------------------------------------------------
create table tenant_settings (
  tenant_id  uuid primary key references tenants(id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table feature_flags (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  description text,
  is_enabled  boolean not null default false,
  tenant_id   uuid references tenants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index feature_flags_code_tenant_key
  on feature_flags (code, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- -----------------------------------------------------------------------------
-- Documents. Console and Portal share one storage bucket, so visibility is a
-- per-file answer, not a per-bucket one.
-- -----------------------------------------------------------------------------
create table documents (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  location_id       uuid references tenant_locations(id) on delete set null,
  entity_type       text,
  entity_id         uuid,
  kind              text not null
                      check (kind in ('report','invoice','credit_note','contract','quote',
                                      'asset','logo','export','other')),
  title             text not null,
  storage_path      text not null,
  mime_type         text,
  size_bytes        bigint,
  sha256            text,
  version           integer not null default 1,
  is_client_visible boolean not null default false,
  uploaded_by       uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index documents_tenant_kind_idx on documents (tenant_id, kind, created_at desc);
create index documents_entity_idx on documents (entity_type, entity_id);
create index documents_client_visible_idx on documents (tenant_id, created_at desc)
  where is_client_visible;

-- -----------------------------------------------------------------------------
-- Reference sequences. Invoice numbers under GST must be gapless within a
-- financial year (Apr-Mar), so they cannot come from count(*)+1 or a Postgres
-- sequence (which loses numbers on rollback).
-- -----------------------------------------------------------------------------
create table reference_sequences (
  id              uuid primary key default gen_random_uuid(),
  owner_tenant_id uuid not null references tenants(id) on delete cascade,
  kind            text not null
                    check (kind in ('invoice','credit_note','contract','engagement','ticket','quote')),
  prefix          text not null default '',
  fy              text not null check (fy ~ '^[0-9]{4}-[0-9]{2}$'),
  next_value      integer not null default 1 check (next_value > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index reference_sequences_key
  on reference_sequences (owner_tenant_id, kind, fy);

-- Indian financial year label for a date: 2026-05-01 -> '2026-27'.
create or replace function app.financial_year(p_on date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(month from p_on) >= 4
      then to_char(p_on, 'YYYY') || '-' || to_char((p_on + interval '1 year'), 'YY')
    else to_char((p_on - interval '1 year'), 'YYYY') || '-' || to_char(p_on, 'YY')
  end;
$$;

-- Gapless allocation. Takes a row lock, so concurrent callers serialise rather
-- than both reading the same next_value.
create or replace function app.next_reference(
  p_owner_tenant_id uuid,
  p_kind            text,
  p_on              date default current_date
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fy     text := app.financial_year(p_on);
  v_prefix text;
  v_value  integer;
begin
  insert into public.reference_sequences (owner_tenant_id, kind, prefix, fy, next_value)
  values (p_owner_tenant_id, p_kind, upper(left(p_kind, 3)), v_fy, 1)
  on conflict (owner_tenant_id, kind, fy) do nothing;

  update public.reference_sequences
     set next_value = next_value + 1,
         updated_at = now()
   where owner_tenant_id = p_owner_tenant_id
     and kind = p_kind
     and fy   = v_fy
  returning prefix, next_value - 1 into v_prefix, v_value;

  return v_prefix || '/' || v_fy || '/' || lpad(v_value::text, 4, '0');
end;
$$;

-- -----------------------------------------------------------------------------
-- Idempotency for UI/API writes -- distinct from webhook dedupe. A
-- double-clicked "Generate Invoice" must not burn two numbers from a gapless
-- GST series.
-- -----------------------------------------------------------------------------
create table idempotency_keys (
  key         text primary key,
  tenant_id   uuid references tenants(id) on delete cascade,
  profile_id  uuid references profiles(id) on delete set null,
  operation   text not null,
  request_hash text,
  response    jsonb,
  status      text not null default 'in_progress'
                check (status in ('in_progress','succeeded','failed')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);
create index idempotency_keys_expiry_idx on idempotency_keys (expires_at);

-- -----------------------------------------------------------------------------
-- Business calendars. "Respond within 4 business hours" is undefined without an
-- Indian and Karnataka-state holiday calendar.
-- -----------------------------------------------------------------------------
create table business_calendars (
  id             uuid primary key default gen_random_uuid(),
  code           text not null,
  name           text not null,
  timezone       text not null default 'Asia/Kolkata',
  workdays       smallint[] not null default '{1,2,3,4,5}',  -- ISO: 1=Mon
  work_start     time not null default '09:30',
  work_end       time not null default '18:30',
  created_at     timestamptz not null default now()
);
create unique index business_calendars_code_key on business_calendars (code);

create table calendar_holidays (
  id          uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references business_calendars(id) on delete cascade,
  holiday_on  date not null,
  name        text not null,
  is_optional boolean not null default false
);
create unique index calendar_holidays_key on calendar_holidays (calendar_id, holiday_on);

-- -----------------------------------------------------------------------------
-- Data processing agreements. AgastyaOne is a Data Processor for the clinic's
-- patient data under the DPDP Act; this is the artifact that records it.
-- -----------------------------------------------------------------------------
create table data_processing_agreements (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  document_id       uuid references documents(id) on delete set null,
  status            text not null default 'draft'
                      check (status in ('draft','sent','signed','expired','terminated')),
  signed_at         timestamptz,
  effective_from    date,
  effective_to      date,
  retention_months  integer,
  data_classes      text[] not null default '{}',
  sub_processors    jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index dpa_tenant_idx on data_processing_agreements (tenant_id, status);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','tenants','tenant_locations','staff_members','memberships',
    'account_assignments','tenant_settings','feature_flags','documents',
    'reference_sequences','data_processing_agreements'
  ] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function app.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
