-- =============================================================================
-- 0004_delivery  (L2)
-- service_instances (the hub), engagements, playbooks, tasks, client action
-- items, tickets, SLAs, and the resourcing model.
--
-- service_instances is defined here rather than with the runtime tables because
-- it is the hinge between commercial and delivery: engagements point at it, and
-- every runtime table hangs off it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Service instances: the thing that EXISTS and persists.
--
-- contract_line_id is nullable and billing_status is explicit, so a comped
-- pilot, an internal service and a one-off website build are all expressible.
-- Cardinality against engagements is genuinely not 1:1 -- one GBP subscription
-- across three branches is one engagement and three instances; a website
-- engagement ends at go-live while the instance keeps tracking uptime.
-- -----------------------------------------------------------------------------
create table service_instances (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  location_id      uuid references tenant_locations(id) on delete set null,
  service_id       uuid not null references service_catalog(id),
  service_code     text not null,
  contract_line_id uuid references contract_lines(id) on delete set null,
  billing_status   text not null default 'billed'
                     check (billing_status in ('billed','comp','trial','internal')),
  status           text not null default 'pending_activation'
                     check (status in ('pending_activation','active','paused','terminated')),
  health_status    text not null default 'unknown'
                     check (health_status in ('unknown','green','amber','red')),
  config           jsonb not null default '{}'::jsonb,
  activated_at     timestamptz,
  terminated_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index service_instances_tenant_idx on service_instances (tenant_id, status);
create index service_instances_tenant_service_idx on service_instances (tenant_id, service_code);
create index service_instances_location_idx on service_instances (tenant_id, location_id);

-- -----------------------------------------------------------------------------
-- Playbooks. Two levels, with `phase` as a label on the step -- a third table
-- needs a tree editor UI before it is usable, and there is no such UI.
-- -----------------------------------------------------------------------------
create table playbooks (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid references service_catalog(id) on delete cascade,
  code        text not null,
  name        text not null,
  kind        text not null default 'onboarding'
                check (kind in ('onboarding','project','retainer_cycle','change_request')),
  version     integer not null default 1,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index playbooks_code_version_key on playbooks (code, version);

create table playbook_steps (
  id                uuid primary key default gen_random_uuid(),
  playbook_id       uuid not null references playbooks(id) on delete cascade,
  phase             text not null default 'delivery',
  name              text not null,
  description       text,
  default_owner_role text
                      check (default_owner_role is null or default_owner_role in
                             ('account_manager','delivery_lead','specialist')),
  -- Steps the CLIENT must do become client_action_items when the engagement
  -- starts. Waiting on the client is the real bottleneck in agency delivery and
  -- it needs to be visible on both sides.
  is_client_action  boolean not null default false,
  sla_days          integer,
  sort_order        integer not null default 0
);
create index playbook_steps_playbook_idx on playbook_steps (playbook_id, sort_order);

-- -----------------------------------------------------------------------------
-- Engagements: the WORK done to an instance. Points at the instance, so there
-- is no bidirectional state to drift.
-- -----------------------------------------------------------------------------
create table engagements (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  service_instance_id uuid references service_instances(id) on delete set null,
  contract_id         uuid references contracts(id) on delete set null,
  playbook_id         uuid references playbooks(id) on delete set null,
  reference           text,
  name                text not null,
  kind                text not null default 'onboarding'
                        check (kind in ('onboarding','project','retainer_cycle','change_request')),
  status              text not null default 'planned'
                        check (status in ('planned','active','blocked','completed','cancelled')),
  health_status       text not null default 'green'
                        check (health_status in ('green','amber','red')),
  owner_staff_id      uuid references staff_members(id) on delete set null,
  planned_start       date,
  planned_end         date,
  actual_start        date,
  actual_end          date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index engagements_tenant_status_idx on engagements (tenant_id, status);
create index engagements_instance_idx on engagements (service_instance_id);
create index engagements_owner_idx on engagements (owner_staff_id) where status in ('planned','active','blocked');
create unique index engagements_reference_key on engagements (reference) where reference is not null;

create table engagement_tasks (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  engagement_id    uuid not null references engagements(id) on delete cascade,
  playbook_step_id uuid references playbook_steps(id) on delete set null,
  phase            text not null default 'delivery',
  title            text not null,
  description      text,
  assignee_staff_id uuid references staff_members(id) on delete set null,
  status           text not null default 'todo'
                     check (status in ('todo','in_progress','blocked','done','skipped')),
  blocked_reason   text,
  due_on           date,
  completed_at     timestamptz,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index engagement_tasks_engagement_idx on engagement_tasks (engagement_id, sort_order);
create index engagement_tasks_assignee_open_idx on engagement_tasks (assignee_staff_id, due_on)
  where status in ('todo','in_progress','blocked');

-- -----------------------------------------------------------------------------
-- Client action items. "We need your GBP access / logo / service list."
-- Visible in the Portal, and at renewal this is the receipt for where the time
-- actually went.
-- -----------------------------------------------------------------------------
create table client_action_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  location_id   uuid references tenant_locations(id) on delete set null,
  engagement_id uuid references engagements(id) on delete cascade,
  title         text not null,
  description   text,
  category      text not null default 'access'
                  check (category in ('access','content','approval','information','payment','other')),
  status        text not null default 'open'
                  check (status in ('open','in_progress','blocked','completed','waived')),
  priority      text not null default 'normal'
                  check (priority in ('low','normal','high','urgent')),
  requested_by  uuid references profiles(id) on delete set null,
  due_on        date,
  requested_at  timestamptz not null default now(),
  completed_at  timestamptz,
  -- Maintained by trigger, not GENERATED: timestamptz -> date depends on the
  -- session TimeZone, so the cast is STABLE and a generated column rejects it.
  -- Kept as a real column so "how long were we blocked on the client" is
  -- indexable rather than recomputed on every renewal report.
  blocked_days  integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index client_action_items_tenant_open_idx on client_action_items (tenant_id, status, due_on)
  where status in ('open','in_progress','blocked');

create or replace function app.client_action_items_blocked_days()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.blocked_days := case
    when new.completed_at is null then null
    else greatest(0, (new.completed_at at time zone 'Asia/Kolkata')::date
                     - (new.requested_at at time zone 'Asia/Kolkata')::date)
  end;
  return new;
end;
$$;

create trigger client_action_items_blocked
  before insert or update of completed_at, requested_at on client_action_items
  for each row execute function app.client_action_items_blocked_days();

-- -----------------------------------------------------------------------------
-- Support desk. sla_definitions is kept (cheap); a running SLA clock engine is
-- deliberately not built until a contract specifies one.
-- -----------------------------------------------------------------------------
create table sla_definitions (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  name            text not null,
  service_id      uuid references service_catalog(id) on delete cascade,
  priority        text not null default 'normal'
                    check (priority in ('low','normal','high','urgent')),
  calendar_id     uuid references business_calendars(id) on delete set null,
  respond_within_minutes  integer,
  resolve_within_minutes  integer,
  created_at      timestamptz not null default now()
);
create unique index sla_definitions_code_key on sla_definitions (code);

create table tickets (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  location_id     uuid references tenant_locations(id) on delete set null,
  service_instance_id uuid references service_instances(id) on delete set null,
  reference       text,
  type            text not null default 'service_request'
                    check (type in ('incident','service_request','question','change_request')),
  priority        text not null default 'normal'
                    check (priority in ('low','normal','high','urgent')),
  subject         text not null,
  body            text,
  status          text not null default 'open'
                    check (status in ('open','acknowledged','in_progress','waiting_client','resolved','closed')),
  sla_definition_id uuid references sla_definitions(id) on delete set null,
  opened_by       uuid references profiles(id) on delete set null,
  assignee_staff_id uuid references staff_members(id) on delete set null,
  first_response_at timestamptz,
  resolved_at     timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tickets_tenant_status_idx on tickets (tenant_id, status, created_at desc);
create index tickets_assignee_open_idx on tickets (assignee_staff_id)
  where status in ('open','acknowledged','in_progress');
create unique index tickets_reference_key on tickets (reference) where reference is not null;

-- -----------------------------------------------------------------------------
-- Resourcing. Modelled now, UI last -- but modelled, so utilisation and
-- per-engagement margin are computable without a migration.
-- -----------------------------------------------------------------------------
create table skills (
  id       uuid primary key default gen_random_uuid(),
  code     text not null,
  name     text not null,
  category text
);
create unique index skills_code_key on skills (code);

create table staff_skills (
  staff_id    uuid not null references staff_members(id) on delete cascade,
  skill_id    uuid not null references skills(id) on delete cascade,
  proficiency smallint not null default 3 check (proficiency between 1 and 5),
  primary key (staff_id, skill_id)
);

create table staff_allocations (
  id            uuid primary key default gen_random_uuid(),
  staff_id      uuid not null references staff_members(id) on delete cascade,
  engagement_id uuid not null references engagements(id) on delete cascade,
  tenant_id     uuid not null references tenants(id) on delete cascade,
  allocation_pct numeric(5,2) not null default 100
                   check (allocation_pct > 0 and allocation_pct <= 100),
  starts_on     date not null,
  ends_on       date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Without this the table is a notes field with extra steps.
  constraint staff_allocations_no_overlap exclude using gist (
    staff_id      with =,
    engagement_id with =,
    daterange(starts_on, ends_on, '[]') with &&
  )
);
create index staff_allocations_staff_idx on staff_allocations (staff_id, starts_on desc);
create index staff_allocations_engagement_idx on staff_allocations (engagement_id);

create table time_entries (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  staff_id      uuid not null references staff_members(id) on delete cascade,
  engagement_id uuid references engagements(id) on delete set null,
  task_id       uuid references engagement_tasks(id) on delete set null,
  entry_date    date not null,
  hours         numeric(5,2) not null check (hours > 0 and hours <= 24),
  is_billable   boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index time_entries_staff_date_idx on time_entries (staff_id, entry_date desc);
create index time_entries_engagement_idx on time_entries (engagement_id, entry_date desc);
create index time_entries_tenant_date_idx on time_entries (tenant_id, entry_date desc);

-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'service_instances','playbooks','engagements','engagement_tasks',
    'client_action_items','tickets','staff_allocations','time_entries'
  ] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function app.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
