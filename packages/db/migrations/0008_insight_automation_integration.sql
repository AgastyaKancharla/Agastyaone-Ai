-- =============================================================================
-- 0008  (L4 Insight, L5 Automation, L6 Integration)
--
-- The event stream is deliberately THREE tables, not one. A single `events`
-- table forces one retention policy onto three different obligations:
--   activity_log -- low volume, human-meaningful, powers the Portal timeline
--   audit_log    -- compliance, restricted read, never deleted (see 0002)
--   raw_events   -- machine exhaust, short retention, the only one partitioned
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Activity: what a human wants to see on a timeline.
-- -----------------------------------------------------------------------------
create table activity_log (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  location_id  uuid references tenant_locations(id) on delete set null,
  service_code text,
  contact_id   uuid references contacts(id) on delete set null,
  actor_id     uuid references profiles(id) on delete set null,
  event_type   text not null,
  title        text not null,
  body         text,
  entity_type  text,
  entity_id    uuid,
  is_client_visible boolean not null default true,
  occurred_at  timestamptz not null default now()
);
create index activity_log_tenant_time_idx on activity_log (tenant_id, occurred_at desc);
create index activity_log_client_visible_idx on activity_log (tenant_id, occurred_at desc)
  where is_client_visible;
create index activity_log_contact_idx on activity_log (contact_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Raw events: high-volume machine exhaust, RANGE-partitioned monthly.
--
-- Partitioned by TIME, not tenant: tenant-hash partitioning would break the
-- Console's "last 24h across all clients" query, which is the whole point of
-- the Console.
--
-- Retention is DETACH + DROP, never DELETE. Dropping a partition is O(1) and
-- returns disk; deleting 500k rows is hours of autovacuum and returns nothing.
--
-- The six queried fields are promoted to real columns and `payload` is left
-- opaque and deliberately NOT GIN-indexed.
-- -----------------------------------------------------------------------------
create table raw_events (
  id           bigint generated always as identity,
  tenant_id    uuid,
  location_id  uuid,
  service_code text,
  event_type   text not null,
  contact_id   uuid,
  external_id  text,
  provider     text,
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  primary key (id, occurred_at),
  -- One provider sending a 2 MB webhook body would otherwise TOAST-bloat the
  -- table.
  constraint raw_events_payload_size_ck check (pg_column_size(payload) < 65536)
) partition by range (occurred_at);

create index raw_events_tenant_time_idx on raw_events (tenant_id, occurred_at desc);
create index raw_events_type_time_idx   on raw_events (event_type, occurred_at desc);

-- Self-managed partitions rather than pg_partman: partman's background worker
-- is not enabled on Supabase, so it would need pg_cron anyway, and at this
-- volume a 20-line function is fewer moving parts than an extension.
create or replace function app.ensure_raw_event_partitions(p_months_ahead integer default 3)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end   date;
  v_name  text;
  i       integer;
begin
  for i in 0..p_months_ahead loop
    v_start := date_trunc('month', current_date)::date + (i || ' months')::interval;
    v_end   := (v_start + interval '1 month')::date;
    v_name  := 'raw_events_' || to_char(v_start, 'YYYY_MM');

    if not exists (select 1 from pg_class where relname = v_name) then
      execute format(
        'create table public.%I partition of public.raw_events for values from (%L) to (%L)',
        v_name, v_start, v_end);
      execute format('alter table public.%I enable row level security', v_name);
      execute format('alter table public.%I force row level security', v_name);
    end if;
  end loop;
end;
$$;

-- Drop partitions older than the retention window.
create or replace function app.prune_raw_event_partitions(p_keep_months integer default 3)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_cutoff date := (date_trunc('month', current_date) - (p_keep_months || ' months')::interval)::date;
  r record;
  v_dropped integer := 0;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_inherits i on i.inhrelid = c.oid
    join pg_class p on p.oid = i.inhparent
    where p.relname = 'raw_events'
      and c.relname ~ '^raw_events_[0-9]{4}_[0-9]{2}$'
      and to_date(right(c.relname, 7), 'YYYY_MM') < v_cutoff
  loop
    execute format('drop table public.%I', r.relname);
    v_dropped := v_dropped + 1;
  end loop;
  return v_dropped;
end;
$$;

select app.ensure_raw_event_partitions(3);

-- -----------------------------------------------------------------------------
-- Metrics.
--
-- metric_snapshots is a REAL table, never a materialized view: matviews cannot
-- carry RLS, which would make the reporting layer a cross-tenant read.
--
-- Snapshots are derived-only and immutable, and carry definition_version so a
-- changed definition never silently rewrites reported history -- that is how a
-- reporting product loses client trust permanently.
-- -----------------------------------------------------------------------------
create table metric_definitions (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  name         text not null,
  service_code text,
  unit         text not null default 'count'
                 check (unit in ('count','percent','currency','seconds','score','ratio')),
  description  text,
  version      integer not null default 1,
  is_client_visible boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index metric_definitions_code_version_key on metric_definitions (code, version);

create table metric_snapshots (
  id                 bigint generated always as identity primary key,
  tenant_id          uuid not null references tenants(id) on delete cascade,
  location_id        uuid references tenant_locations(id) on delete set null,
  service_code       text,
  metric_code        text not null,
  definition_version integer not null default 1,
  period_start       date not null,
  period_end         date not null,
  granularity        text not null default 'day'
                       check (granularity in ('day','week','month','quarter','year')),
  value              numeric(18,4) not null,
  computed_at        timestamptz not null default now()
);
create unique index metric_snapshots_key on metric_snapshots
  (tenant_id, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
   metric_code, definition_version, granularity, period_start);
create index metric_snapshots_tenant_metric_idx on metric_snapshots
  (tenant_id, metric_code, period_start desc);

create table report_definitions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid references tenants(id) on delete cascade,
  code         text not null,
  name         text not null,
  service_code text,
  spec         jsonb not null default '{}'::jsonb,
  cadence      text not null default 'monthly'
                 check (cadence in ('on_demand','weekly','monthly','quarterly')),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index report_definitions_tenant_idx on report_definitions (tenant_id) where is_active;

create table report_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  definition_id uuid references report_definitions(id) on delete set null,
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'queued'
                  check (status in ('queued','running','completed','failed')),
  document_id   uuid references documents(id) on delete set null,
  error         text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index report_runs_tenant_time_idx on report_runs (tenant_id, created_at desc);

create table alerts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  location_id  uuid references tenant_locations(id) on delete set null,
  service_code text,
  severity     text not null default 'info'
                 check (severity in ('info','warning','critical')),
  code         text not null,
  title        text not null,
  body         text,
  entity_type  text,
  entity_id    uuid,
  status       text not null default 'open'
                 check (status in ('open','acknowledged','resolved','muted')),
  acknowledged_by uuid references profiles(id) on delete set null,
  raised_at    timestamptz not null default now(),
  resolved_at  timestamptz
);
create index alerts_tenant_open_idx on alerts (tenant_id, severity, raised_at desc)
  where status = 'open';

-- -----------------------------------------------------------------------------
-- L5 Automation.
--
-- automation_runs sits deliberately alongside time_entries so automated and
-- human delivery capacity are measurable in the same terms -- which is the
-- honest version of "resourcing" for a company whose workforce is partly
-- software.
-- -----------------------------------------------------------------------------
create table automation_runs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  location_id   uuid references tenant_locations(id) on delete set null,
  service_code  text,
  kind          text not null,
  status        text not null default 'queued'
                  check (status in ('queued','running','succeeded','failed','cancelled')),
  entity_type   text,
  entity_id     uuid,
  attempt       integer not null default 1,
  input         jsonb not null default '{}'::jsonb,
  output        jsonb,
  error         text,
  duration_ms   integer,
  cost_units    numeric(12,4),
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index automation_runs_tenant_time_idx on automation_runs (tenant_id, created_at desc);
create index automation_runs_kind_status_idx on automation_runs (kind, status, created_at desc);

create table schedules (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  code          text not null,
  kind          text not null,
  cron          text,
  payload       jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index schedules_due_idx on schedules (next_run_at) where is_active;

-- Notifications are AgastyaOne -> client comms, distinct from `messages`, which
-- is the clinic talking to its patients.
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  code        text not null,
  title       text not null,
  body        text,
  link_url    text,
  severity    text not null default 'info'
                check (severity in ('info','warning','critical')),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_profile_unread_idx on notifications (profile_id, created_at desc)
  where read_at is null;

create table notification_preferences (
  profile_id uuid not null references profiles(id) on delete cascade,
  code       text not null,
  in_app     boolean not null default true,
  email      boolean not null default true,
  whatsapp   boolean not null default false,
  primary key (profile_id, code)
);

-- Without an outbox, sending happens inline in a request and a provider timeout
-- double-sends.
create table outbox (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references tenants(id) on delete cascade,
  channel       text not null check (channel in ('email','whatsapp','sms','webhook','push')),
  recipient     text not null,
  template      text,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                  check (status in ('pending','sending','sent','failed','dead')),
  attempts      integer not null default 0,
  max_attempts  integer not null default 5,
  last_error    text,
  dedupe_key    text,
  available_at  timestamptz not null default now(),
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index outbox_dedupe_key on outbox (dedupe_key) where dedupe_key is not null;
create index outbox_due_idx on outbox (available_at) where status in ('pending','sending');

-- -----------------------------------------------------------------------------
-- L6 Integration.
--
-- Credentials live in Supabase Vault and are referenced by id -- never stored
-- in columns here. The health fields exist because Google OAuth refresh tokens
-- get revoked silently, and today the client would notice before we do.
-- -----------------------------------------------------------------------------
create table integrations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  location_id        uuid references tenant_locations(id) on delete set null,
  provider           text not null
                       check (provider in ('google_business_profile','google_analytics','meta_whatsapp',
                                           'wati','gallabox','aisensy','exotel','knowlarity','twilio',
                                           'resend','ses','razorpay','other')),
  external_account_id text,
  display_name       text,
  scopes             text[] not null default '{}',
  vault_secret_id    uuid,
  status             text not null default 'disconnected'
                       check (status in ('connected','disconnected','expired','error','pending')),
  connected_at       timestamptz,
  expires_at         timestamptz,
  last_refreshed_at  timestamptz,
  last_checked_at    timestamptz,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index integrations_key on integrations
  (tenant_id, provider, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index integrations_unhealthy_idx on integrations (status, expires_at)
  where status in ('expired','error');

create table webhook_events (
  id            bigint generated always as identity primary key,
  provider      text not null,
  external_id   text not null,
  tenant_id     uuid references tenants(id) on delete set null,
  event_type    text,
  payload       jsonb not null default '{}'::jsonb,
  signature_ok  boolean,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  attempts      integer not null default 0,
  error         text
);
-- Idempotent replay: a provider re-delivering the same event is a no-op.
create unique index webhook_events_key on webhook_events (provider, external_id);
create index webhook_events_unprocessed_idx on webhook_events (received_at)
  where processed_at is null;

-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['schedules','outbox','integrations'] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function app.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
