-- =============================================================================
-- 0007_runtime_engagement  (L3)
-- Call Tracking, Booking Capture & Routing, Front Desk Bundle, CRM,
-- Lifecycle Bundle.
--
-- Everything here resolves to a contact via app.resolve_contact(), which is
-- what makes this one CRM rather than five parallel inboxes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Call Tracking
-- -----------------------------------------------------------------------------
create table tracking_numbers (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  location_id         uuid references tenant_locations(id) on delete set null,
  service_instance_id uuid references service_instances(id) on delete set null,
  provider            text not null default 'exotel'
                        check (provider in ('exotel','knowlarity','twilio','other')),
  provider_number_id  text,
  phone_e164          text not null,
  forwards_to_e164    text,
  label               text,
  source              text,            -- 'gbp' | 'website' | 'print' | campaign code
  status              text not null default 'active'
                        check (status in ('provisioning','active','paused','released')),
  provisioned_on      date,
  released_on         date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index tracking_numbers_phone_key on tracking_numbers (phone_e164);
create index tracking_numbers_tenant_idx on tracking_numbers (tenant_id, status);

create table calls (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  location_id        uuid references tenant_locations(id) on delete set null,
  tracking_number_id uuid references tracking_numbers(id) on delete set null,
  contact_id         uuid references contacts(id) on delete set null,
  provider           text,
  provider_call_id   text,
  direction          text not null default 'inbound'
                       check (direction in ('inbound','outbound')),
  from_e164          text,
  to_e164            text,
  status             text not null default 'completed'
                       check (status in ('ringing','in_progress','completed','missed','busy','failed','voicemail')),
  is_missed          boolean not null default false,
  is_first_time_caller boolean,
  duration_seconds   integer not null default 0,
  recording_url      text,
  transcript         text,
  outcome            text
                       check (outcome is null or outcome in
                         ('booked','enquiry','existing_patient','spam','wrong_number','no_answer','other')),
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  created_at         timestamptz not null default now()
);
create unique index calls_provider_key on calls (provider, provider_call_id)
  where provider_call_id is not null;
create index calls_tenant_time_idx on calls (tenant_id, started_at desc);
create index calls_location_time_idx on calls (tenant_id, location_id, started_at desc);
create index calls_contact_idx on calls (contact_id, started_at desc);
create index calls_missed_idx on calls (tenant_id, started_at desc) where is_missed;

-- -----------------------------------------------------------------------------
-- Booking Capture & Routing
-- -----------------------------------------------------------------------------
create table routing_rules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  location_id uuid references tenant_locations(id) on delete set null,
  name        text not null,
  match_on    jsonb not null default '{}'::jsonb,
  action      jsonb not null default '{}'::jsonb,
  priority    integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index routing_rules_tenant_idx on routing_rules (tenant_id, priority) where is_active;

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  location_id    uuid references tenant_locations(id) on delete set null,
  contact_id     uuid references contacts(id) on delete set null,
  reference      text,
  source         text not null default 'website'
                   check (source in ('website','whatsapp','call','walk_in','gbp','referral','other')),
  service_requested text,
  status         text not null default 'requested'
                   check (status in ('requested','confirmed','rescheduled','cancelled','no_show','completed')),
  requested_for  timestamptz,
  confirmed_for  timestamptz,
  assigned_to    text,
  routed_by_rule_id uuid references routing_rules(id) on delete set null,
  notes          text,
  cancelled_reason text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index bookings_tenant_time_idx on bookings (tenant_id, created_at desc);
create index bookings_location_slot_idx on bookings (tenant_id, location_id, confirmed_for);
create index bookings_contact_idx on bookings (contact_id, created_at desc);
create unique index bookings_reference_key on bookings (tenant_id, reference) where reference is not null;

-- -----------------------------------------------------------------------------
-- Front Desk Bundle: WhatsApp Automation + AI Receptionist + Missed-Call +
-- Unified Inbox. One conversation table across channels is what makes the inbox
-- "unified" rather than four tabs.
-- -----------------------------------------------------------------------------
create table channels (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  location_id         uuid references tenant_locations(id) on delete set null,
  service_instance_id uuid references service_instances(id) on delete set null,
  kind                text not null
                        check (kind in ('whatsapp','sms','email','webchat','instagram','facebook')),
  provider            text,
  external_id         text,
  display_name        text,
  status              text not null default 'active'
                        check (status in ('provisioning','active','paused','disconnected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index channels_tenant_idx on channels (tenant_id, kind, status);

create table agent_configs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  location_id  uuid references tenant_locations(id) on delete set null,
  channel_id   uuid references channels(id) on delete cascade,
  name         text not null,
  persona      text,
  system_prompt text,
  knowledge    jsonb not null default '{}'::jsonb,
  handoff_rules jsonb not null default '{}'::jsonb,
  business_hours_only boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index agent_configs_tenant_idx on agent_configs (tenant_id) where is_active;

create table conversations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  location_id    uuid references tenant_locations(id) on delete set null,
  channel_id     uuid not null references channels(id) on delete cascade,
  contact_id     uuid references contacts(id) on delete set null,
  external_id    text,
  subject        text,
  status         text not null default 'open'
                   check (status in ('open','pending','snoozed','resolved','spam')),
  -- Who is driving: the AI receptionist or a person.
  handled_by     text not null default 'ai'
                   check (handled_by in ('ai','human','unassigned')),
  assignee_staff_id uuid references staff_members(id) on delete set null,
  last_message_at timestamptz,
  unread_count   integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index conversations_channel_external_key on conversations (channel_id, external_id)
  where external_id is not null;
create index conversations_tenant_status_idx on conversations (tenant_id, status, last_message_at desc);
create index conversations_contact_idx on conversations (contact_id, last_message_at desc);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  external_id     text,
  direction       text not null check (direction in ('inbound','outbound')),
  sender_type     text not null default 'contact'
                    check (sender_type in ('contact','ai','staff','system')),
  sender_staff_id uuid references staff_members(id) on delete set null,
  body            text,
  media           jsonb not null default '[]'::jsonb,
  template_name   text,
  status          text not null default 'sent'
                    check (status in ('queued','sent','delivered','read','failed')),
  failure_reason  text,
  sent_at         timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create unique index messages_external_key on messages (conversation_id, external_id)
  where external_id is not null;
create index messages_conversation_time_idx on messages (conversation_id, sent_at desc);
create index messages_tenant_time_idx on messages (tenant_id, sent_at desc);

-- -----------------------------------------------------------------------------
-- CRM. This is the CLIENT's pipeline (their patients), distinct from
-- AgastyaOne's own sales -- which runs in the same tables because AgastyaOne is
-- tenant #1.
-- -----------------------------------------------------------------------------
create table pipelines (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create unique index pipelines_default_key on pipelines (tenant_id) where is_default;

create table pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name        text not null,
  probability numeric(5,2) not null default 0 check (probability between 0 and 100),
  is_won      boolean not null default false,
  is_lost     boolean not null default false,
  sort_order  integer not null default 0
);
create index pipeline_stages_pipeline_idx on pipeline_stages (pipeline_id, sort_order);

create table leads (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  location_id uuid references tenant_locations(id) on delete set null,
  contact_id  uuid not null references contacts(id) on delete cascade,
  source      text not null default 'website'
                check (source in ('website','whatsapp','call','gbp','referral','walk_in','campaign','other')),
  source_detail text,
  status      text not null default 'new'
                check (status in ('new','contacted','qualified','unqualified','converted','lost')),
  owner_staff_id uuid references staff_members(id) on delete set null,
  first_touch_at timestamptz not null default now(),
  converted_at   timestamptz,
  lost_reason    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index leads_tenant_status_idx on leads (tenant_id, status, created_at desc);
create index leads_contact_idx on leads (contact_id);

create table deals (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  pipeline_id  uuid not null references pipelines(id) on delete cascade,
  stage_id     uuid not null references pipeline_stages(id),
  contact_id   uuid references contacts(id) on delete set null,
  lead_id      uuid references leads(id) on delete set null,
  title        text not null,
  value        numeric(14,2) not null default 0,
  currency_code text not null default 'INR',
  status       text not null default 'open'
                 check (status in ('open','won','lost','abandoned')),
  owner_staff_id uuid references staff_members(id) on delete set null,
  expected_close_on date,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index deals_tenant_stage_idx on deals (tenant_id, stage_id) where status = 'open';
create index deals_contact_idx on deals (contact_id);

create table activities (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  kind        text not null
                check (kind in ('note','call','email','whatsapp','meeting','task')),
  subject     text,
  body        text,
  due_at      timestamptz,
  completed_at timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index activities_tenant_time_idx on activities (tenant_id, created_at desc);
create index activities_contact_idx on activities (contact_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Lifecycle Bundle: Recall + Reactivation + Post-Treatment Follow-Up.
--
-- Enrollment checks consent at enroll time AND at send time; a contact who opts
-- out mid-campaign must stop receiving messages, which is why suppression is a
-- status on the enrollment rather than a delete.
-- -----------------------------------------------------------------------------
create table campaigns (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  location_id    uuid references tenant_locations(id) on delete set null,
  service_instance_id uuid references service_instances(id) on delete set null,
  name           text not null,
  kind           text not null
                   check (kind in ('recall','reactivation','post_treatment','promotion','other')),
  channel        text not null default 'whatsapp'
                   check (channel in ('whatsapp','sms','email')),
  audience_rules jsonb not null default '{}'::jsonb,
  schedule       jsonb not null default '{}'::jsonb,
  status         text not null default 'draft'
                   check (status in ('draft','scheduled','running','paused','completed','archived')),
  starts_on      date,
  ends_on        date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index campaigns_tenant_status_idx on campaigns (tenant_id, status);

create table campaign_enrollments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  contact_id   uuid not null references contacts(id) on delete cascade,
  status       text not null default 'enrolled'
                 check (status in ('enrolled','in_progress','completed','suppressed','opted_out','failed')),
  suppression_reason text,
  enrolled_at  timestamptz not null default now(),
  completed_at timestamptz
);
create unique index campaign_enrollments_key on campaign_enrollments (campaign_id, contact_id);
create index campaign_enrollments_tenant_status_idx on campaign_enrollments (tenant_id, status);

create table campaign_messages (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  enrollment_id  uuid not null references campaign_enrollments(id) on delete cascade,
  message_id     uuid references messages(id) on delete set null,
  step_index     integer not null default 0,
  template_name  text,
  status         text not null default 'pending'
                   check (status in ('pending','sent','delivered','read','failed','skipped')),
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  failure_reason text,
  created_at     timestamptz not null default now()
);
create index campaign_messages_due_idx on campaign_messages (scheduled_for) where status = 'pending';
create index campaign_messages_enrollment_idx on campaign_messages (enrollment_id, step_index);

-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tracking_numbers','routing_rules','bookings','channels','agent_configs',
    'conversations','leads','deals','campaigns'
  ] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function app.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
