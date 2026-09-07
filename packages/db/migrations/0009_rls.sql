-- =============================================================================
-- 0009_rls
-- Row Level Security on every table.
--
-- Policy shape, and why:
--
--  * ONE policy per (table, command). Permissive policies are OR'd and ALL of
--    them evaluate, so N policies means N function calls per row. Splitting by
--    command means exactly one policy runs for any given statement.
--
--  * Policies are ROW-INDEPENDENT:
--        tenant_id in (select unnest(app.accessible_tenant_ids()))
--    A function taking the row as an argument cannot be hoisted by the planner
--    and runs once per row; as a row-independent subquery it becomes a single
--    hashed InitPlan per query. Bigger win than the better-known
--    (select auth.uid()) wrapping.
--
--    Note the `unnest`. `= any ((select f()))` parses as the ANY(subquery)
--    form, which compares uuid against the row value uuid[] and fails with
--    "operator does not exist: uuid = uuid[]". Unnesting to a rowset keeps both
--    the types and the single evaluation.
--
--  * Predicates are equality and set membership ONLY. RLS quals are evaluated
--    before non-LEAKPROOF user quals, so business logic in a policy both
--    defeats indexes and changes plans. Entitlement checks in particular live
--    at the route and write path, never here.
--
--  * FORCE ROW LEVEL SECURITY everywhere, so the table owner and any
--    mis-scoped SECURITY DEFINER code are also subject to policy.
--
--  * Tables whose tenant_id is NULLABLE hold global rows (a platform-wide
--    schedule, a shared report template). `tenant_id IN (...)` is NULL for
--    those, which would make them invisible to everyone -- so they get an
--    explicit `tenant_id is null or ...`. Safe because the staff-scoped ones
--    are already gated by app.is_staff().
-- =============================================================================

do $$
declare
  -- Visible to staff-with-access AND to client users of that tenant.
  shared_tables text[] := array[
    'tenant_locations','tenant_settings','contracts','contract_lines','subscriptions',
    'invoices','invoice_lines','credit_notes','payments','tenant_entitlements',
    'data_processing_agreements','service_instances','engagements','client_action_items',
    'tickets','contacts','contact_identities','websites','website_checks',
    'nap_source_of_truth','nap_audits','nap_audit_results','nap_field_diffs','citations',
    'geo_prompts','geo_runs','geo_mentions','review_sources','reviews','review_requests',
    'review_responses','tracking_numbers','calls','routing_rules','bookings','channels',
    'agent_configs','conversations','messages','pipelines','pipeline_stages','leads',
    'deals','activities','campaigns','campaign_enrollments','campaign_messages',
    'metric_snapshots','report_runs','alerts','integrations'
  ];

  -- Same, but tenant_id is nullable (global rows must stay visible).
  shared_nullable_tables text[] := array['report_definitions'];

  -- Tenant-scoped but internal: cost, capacity, delivery mechanics, machine
  -- exhaust. Clients must never read these even for their own tenant.
  staff_tables text[] := array[
    'engagement_tasks','time_entries','staff_allocations','contact_merges',
    'contact_match_candidates'
  ];

  -- Staff-only AND nullable tenant_id.
  staff_nullable_tables text[] := array[
    'automation_runs','schedules','outbox','idempotency_keys','feature_flags'
  ];

  t    text;
  pred text;
begin
  -- Shared, NOT NULL tenant_id
  foreach t in array shared_tables loop
    pred := 'tenant_id in (select unnest(app.accessible_tenant_ids()))';
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ( %s )',
                   t || '_sel', t, pred);
    execute format('create policy %I on public.%I for insert to authenticated with check ( %s and (select app.is_staff()) )',
                   t || '_ins', t, pred);
    execute format('create policy %I on public.%I for update to authenticated using ( %s and (select app.is_staff()) ) with check ( %s and (select app.is_staff()) )',
                   t || '_upd', t, pred, pred);
    execute format('create policy %I on public.%I for delete to authenticated using ( %s and (select app.is_staff()) )',
                   t || '_del', t, pred);
  end loop;

  -- Shared, NULLABLE tenant_id
  foreach t in array shared_nullable_tables loop
    pred := '(tenant_id is null or tenant_id in (select unnest(app.accessible_tenant_ids())))';
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ( %s )',
                   t || '_sel', t, pred);
    execute format('create policy %I on public.%I for insert to authenticated with check ( %s and (select app.is_staff()) )',
                   t || '_ins', t, pred);
    execute format('create policy %I on public.%I for update to authenticated using ( %s and (select app.is_staff()) ) with check ( %s and (select app.is_staff()) )',
                   t || '_upd', t, pred, pred);
    execute format('create policy %I on public.%I for delete to authenticated using ( %s and (select app.is_staff()) )',
                   t || '_del', t, pred);
  end loop;

  -- Staff-only, NOT NULL tenant_id
  foreach t in array staff_tables loop
    pred := 'tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff())';
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ( %s )',
                   t || '_sel', t, pred);
    execute format('create policy %I on public.%I for insert to authenticated with check ( %s )',
                   t || '_ins', t, pred);
    execute format('create policy %I on public.%I for update to authenticated using ( %s ) with check ( %s )',
                   t || '_upd', t, pred, pred);
    execute format('create policy %I on public.%I for delete to authenticated using ( %s )',
                   t || '_del', t, pred);
  end loop;

  -- Staff-only, NULLABLE tenant_id
  foreach t in array staff_nullable_tables loop
    pred := '(tenant_id is null or tenant_id in (select unnest(app.accessible_tenant_ids()))) and (select app.is_staff())';
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ( %s )',
                   t || '_sel', t, pred);
    execute format('create policy %I on public.%I for insert to authenticated with check ( %s )',
                   t || '_ins', t, pred);
    execute format('create policy %I on public.%I for update to authenticated using ( %s ) with check ( %s )',
                   t || '_upd', t, pred, pred);
    execute format('create policy %I on public.%I for delete to authenticated using ( %s )',
                   t || '_del', t, pred);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- reference_sequences is keyed on owner_tenant_id -- the entity ISSUING the
-- document (AgastyaOne), not the party being billed. It is deliberately not in
-- the generic loop above, which assumes a `tenant_id` column.
-- -----------------------------------------------------------------------------
alter table reference_sequences enable row level security;
alter table reference_sequences force  row level security;
create policy reference_sequences_sel on reference_sequences for select to authenticated
  using ( owner_tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy reference_sequences_ins on reference_sequences for insert to authenticated
  with check ( owner_tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy reference_sequences_upd on reference_sequences for update to authenticated
  using      ( owner_tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
  with check ( owner_tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );

-- -----------------------------------------------------------------------------
-- tenants
-- -----------------------------------------------------------------------------
alter table tenants enable row level security;
alter table tenants force  row level security;
create policy tenants_sel on tenants for select to authenticated
  using ( id in (select unnest(app.accessible_tenant_ids())) );
create policy tenants_ins on tenants for insert to authenticated
  with check ( (select app.is_staff()) );
create policy tenants_upd on tenants for update to authenticated
  using      ( id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
  with check ( id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy tenants_del on tenants for delete to authenticated
  using ( false );   -- tenants are churned, never deleted

-- -----------------------------------------------------------------------------
-- documents and activity_log: clients see only rows explicitly marked
-- client-visible. Console and Portal share one storage bucket, so this is a
-- per-row answer, not a per-bucket one.
-- -----------------------------------------------------------------------------
alter table documents enable row level security;
alter table documents force  row level security;
create policy documents_sel on documents for select to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids()))
          and ( is_client_visible or (select app.is_staff()) ) );
create policy documents_ins on documents for insert to authenticated
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy documents_upd on documents for update to authenticated
  using      ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy documents_del on documents for delete to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );

alter table activity_log enable row level security;
alter table activity_log force  row level security;
create policy activity_log_sel on activity_log for select to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids()))
          and ( is_client_visible or (select app.is_staff()) ) );
create policy activity_log_ins on activity_log for insert to authenticated
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );

-- -----------------------------------------------------------------------------
-- Identity
-- -----------------------------------------------------------------------------
alter table profiles enable row level security;
alter table profiles force  row level security;
create policy profiles_sel on profiles for select to authenticated
  using ( id = (select auth.uid()) or (select app.is_staff()) );
create policy profiles_upd on profiles for update to authenticated
  using      ( id = (select auth.uid()) or (select app.is_staff()) )
  with check ( id = (select auth.uid()) or (select app.is_staff()) );

alter table memberships enable row level security;
alter table memberships force  row level security;
create policy memberships_sel on memberships for select to authenticated
  using ( profile_id = (select auth.uid())
          or tenant_id in (select unnest(app.accessible_tenant_ids())) );
create policy memberships_ins on memberships for insert to authenticated
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy memberships_upd on memberships for update to authenticated
  using      ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy memberships_del on memberships for delete to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );

-- Staff-only tables with no tenant column of their own.
do $$
declare t text;
begin
  foreach t in array array['staff_members','account_assignments','skills','staff_skills',
                           'playbooks','playbook_steps','sla_definitions','user_roles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ( (select app.is_staff()) )', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ( (select app.is_staff()) )', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ( (select app.is_staff()) ) with check ( (select app.is_staff()) )', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ( (select app.is_staff()) )', t || '_del', t);
  end loop;
end $$;

-- Reference data: readable by any signed-in user (the Portal needs service and
-- directory names), writable by staff only.
do $$
declare t text;
begin
  foreach t in array array['service_catalog','service_components','service_deliverables',
                           'directories','roles','permissions','role_permissions',
                           'business_calendars','calendar_holidays','metric_definitions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ( true )', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ( (select app.is_staff()) )', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ( (select app.is_staff()) ) with check ( (select app.is_staff()) )', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ( (select app.is_staff()) )', t || '_del', t);
  end loop;
end $$;

-- Per-user tables.
alter table notifications enable row level security;
alter table notifications force  row level security;
create policy notifications_sel on notifications for select to authenticated
  using ( profile_id = (select auth.uid()) );
create policy notifications_upd on notifications for update to authenticated
  using      ( profile_id = (select auth.uid()) )
  with check ( profile_id = (select auth.uid()) );

alter table notification_preferences enable row level security;
alter table notification_preferences force  row level security;
create policy notification_preferences_all on notification_preferences for all to authenticated
  using      ( profile_id = (select auth.uid()) )
  with check ( profile_id = (select auth.uid()) );

-- -----------------------------------------------------------------------------
-- Machine-only tables. RLS on with no policy for `authenticated`, so nothing
-- reaches them over the API at all. The worker uses the service role, which
-- bypasses RLS by design. raw_events partitions inherit the parent's policies.
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['audit_log','raw_events','webhook_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
  end loop;
end $$;

-- audit_log stays readable by staff for accessible tenants -- being able to
-- answer "who looked at my data" is the reason it exists.
create policy audit_log_sel on audit_log for select to authenticated
  using ( (select app.is_staff())
          and ( tenant_id is null or tenant_id in (select unnest(app.accessible_tenant_ids())) ) );

-- -----------------------------------------------------------------------------
-- The anonymous role gets nothing, anywhere.
-- -----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on tables from anon;
