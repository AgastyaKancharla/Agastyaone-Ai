-- =============================================================================
-- 0006_runtime_presence  (L3)
-- Website, GBP + Directory/NAP, GEO, Review Automation.
-- Every table carries tenant_id (for RLS) and location_id (because these are
-- all per-branch facts).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Website. AgastyaOne builds it; the client buys and owns the domain. So this
-- tracks a build plus a domain plus uptime -- not hosting, not a CMS.
-- -----------------------------------------------------------------------------
create table websites (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  location_id         uuid references tenant_locations(id) on delete set null,
  service_instance_id uuid references service_instances(id) on delete set null,
  domain              text not null,
  is_domain_client_owned boolean not null default true,
  registrar           text,
  domain_expires_on   date,
  platform            text,
  repo_url            text,
  live_url            text,
  status              text not null default 'planned'
                        check (status in ('planned','in_build','staging','live','retired')),
  went_live_on        date,
  ssl_expires_on      date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index websites_tenant_idx on websites (tenant_id, status);
create unique index websites_domain_key on websites (tenant_id, domain);

create table website_checks (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references tenants(id) on delete cascade,
  website_id   uuid not null references websites(id) on delete cascade,
  checked_at   timestamptz not null default now(),
  is_up        boolean not null,
  http_status  integer,
  response_ms  integer,
  ssl_valid    boolean,
  error        text
);
create index website_checks_website_time_idx on website_checks (website_id, checked_at desc);
create index website_checks_tenant_time_idx on website_checks (tenant_id, checked_at desc);

-- -----------------------------------------------------------------------------
-- Directory registry. A keyed registry rather than a hardcoded array, so an
-- audit can target a subset.
-- -----------------------------------------------------------------------------
create table directories (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  domain      text not null,
  country     text not null default 'IN',
  verticals   text[] not null default '{}',
  is_enabled  boolean not null default true,
  weight      numeric(4,2) not null default 1.00,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create unique index directories_code_key on directories (code);

-- -----------------------------------------------------------------------------
-- NAP source of truth, SCD-2.
--
-- The clinic relocates or adds a line, and without versioning every historical
-- audit becomes uninterpretable -- and the first client challenge ("you audited
-- the wrong address") is unanswerable. Audits pin the exact version they ran
-- against.
-- -----------------------------------------------------------------------------
create table nap_source_of_truth (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  location_id    uuid not null references tenant_locations(id) on delete cascade,
  version        integer not null default 1,
  business_name  text,
  address_line1  text,
  address_line2  text,
  locality       text,
  city           text,
  state          text,
  pincode        text,
  phone_raw      text,
  phone_e164     text generated always as (app.normalize_phone_e164(phone_raw)) stored,
  secondary_phone_raw text,
  website        text,
  category       text,
  working_hours  jsonb,
  valid_from     timestamptz not null default now(),
  valid_to       timestamptz,
  is_current     boolean not null default true,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index nap_sot_location_idx on nap_source_of_truth (location_id, valid_from desc);
create unique index nap_sot_current_key on nap_source_of_truth (location_id) where is_current;

-- -----------------------------------------------------------------------------
-- Audits. Results are stored relationally, not as a report blob -- queryable
-- history is the entire point of having a schema.
-- -----------------------------------------------------------------------------
create table nap_audits (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id) on delete cascade,
  location_id          uuid not null references tenant_locations(id) on delete cascade,
  service_instance_id  uuid references service_instances(id) on delete set null,
  source_of_truth_id   uuid not null references nap_source_of_truth(id),
  status               text not null default 'queued'
                         check (status in ('queued','running','completed','failed','cancelled')),
  requested_by         uuid references profiles(id) on delete set null,

  directories_requested integer not null default 0,
  directories_checked   integer not null default 0,   -- excludes ERROR
  directories_errored   integer not null default 0,

  consistent_count     integer not null default 0,
  drift_count          integer not null default 0,
  inconsistent_count   integer not null default 0,
  not_found_count      integer not null default 0,
  ambiguous_count      integer not null default 0,

  -- Mean confidence over CHECKED directories only. An adapter that was blocked
  -- must never drag a client's score down; coverage is reported separately.
  audit_score          numeric(5,2),
  coverage_pct         numeric(5,2),

  error_message        text,
  queued_at            timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- The five status counters plus ambiguous must partition the checked set.
  constraint nap_audits_counts_ck check (
    status <> 'completed'
    or (consistent_count + drift_count + inconsistent_count + not_found_count + ambiguous_count)
       = directories_checked
  )
);
create index nap_audits_tenant_time_idx on nap_audits (tenant_id, created_at desc);
create index nap_audits_location_time_idx on nap_audits (location_id, created_at desc);
create index nap_audits_pending_idx on nap_audits (status) where status in ('queued','running');

create table nap_audit_results (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  audit_id       uuid not null references nap_audits(id) on delete cascade,
  directory_id   uuid not null references directories(id),
  directory_code text not null,
  status         text not null
                   check (status in ('consistent','drift','inconsistent','not_found','ambiguous','error')),
  -- The real listing URL. Never the search URL -- overloading that as the
  -- "was it found" test makes every result read as found.
  listing_url    text,
  found          boolean not null default false,
  -- How confident we are this listing is the client's business at all, as
  -- distinct from how well it matches. Below threshold the result is
  -- 'ambiguous' and held for review rather than shown to the client.
  match_confidence numeric(5,2),
  runner_up_margin numeric(5,2),
  overall_confidence numeric(5,2),
  is_claimed     boolean,
  rating         numeric(3,2),
  review_count   integer,
  error_message  text,
  raw            jsonb,
  checked_at     timestamptz not null default now()
);
create index nap_audit_results_audit_idx on nap_audit_results (audit_id);
create index nap_audit_results_tenant_dir_idx on nap_audit_results (tenant_id, directory_code, checked_at desc);

create table nap_field_diffs (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  result_id     uuid not null references nap_audit_results(id) on delete cascade,
  field_name    text not null
                  check (field_name in ('business_name','address','phone','website','category')),
  source_value  text,
  found_value   text,
  -- 'missing' (the listing shows nothing) is deliberately distinct from
  -- 'mismatch' (the listing shows someone else's). They need opposite client
  -- actions: "add your number" vs "someone has the wrong number".
  match_status  text not null
                  check (match_status in ('exact','drift','mismatch','missing')),
  similarity_score numeric(5,2),
  notes         text
);
create index nap_field_diffs_result_idx on nap_field_diffs (result_id);

create table citations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  location_id   uuid not null references tenant_locations(id) on delete cascade,
  directory_id  uuid not null references directories(id),
  listing_url   text,
  status        text not null default 'unknown'
                  check (status in ('unknown','live','claimed','unclaimed','duplicate','removed')),
  is_claimed    boolean,
  last_verified_at timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index citations_key on citations (location_id, directory_id);

-- -----------------------------------------------------------------------------
-- GEO: visibility inside AI answer engines.
-- -----------------------------------------------------------------------------
create table geo_prompts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  location_id uuid references tenant_locations(id) on delete set null,
  prompt      text not null,
  intent      text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index geo_prompts_tenant_idx on geo_prompts (tenant_id) where is_active;

create table geo_runs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  location_id  uuid references tenant_locations(id) on delete set null,
  prompt_id    uuid not null references geo_prompts(id) on delete cascade,
  engine       text not null
                 check (engine in ('chatgpt','perplexity','gemini','claude','copilot','other')),
  status       text not null default 'queued'
                 check (status in ('queued','running','completed','failed')),
  response_text text,
  was_mentioned boolean not null default false,
  position     integer,
  share_of_voice numeric(5,2),
  run_at       timestamptz not null default now(),
  error        text
);
create index geo_runs_tenant_time_idx on geo_runs (tenant_id, run_at desc);
create index geo_runs_prompt_engine_idx on geo_runs (prompt_id, engine, run_at desc);

create table geo_mentions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  run_id       uuid not null references geo_runs(id) on delete cascade,
  entity_name  text not null,
  is_client    boolean not null default false,
  position     integer,
  cited_url    text,
  sentiment    text check (sentiment is null or sentiment in ('positive','neutral','negative'))
);
create index geo_mentions_run_idx on geo_mentions (run_id);

-- -----------------------------------------------------------------------------
-- Review Automation.
-- -----------------------------------------------------------------------------
create table review_sources (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  location_id  uuid not null references tenant_locations(id) on delete cascade,
  platform     text not null
                 check (platform in ('google','practo','justdial','facebook','other')),
  external_id  text,
  profile_url  text,
  is_active    boolean not null default true,
  last_synced_at timestamptz,
  created_at   timestamptz not null default now()
);
create unique index review_sources_key on review_sources (location_id, platform);

create table reviews (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  location_id   uuid not null references tenant_locations(id) on delete cascade,
  source_id     uuid not null references review_sources(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  external_id   text not null,
  author_name   text,
  rating        smallint check (rating between 1 and 5),
  body          text,
  sentiment     text check (sentiment is null or sentiment in ('positive','neutral','negative')),
  posted_at     timestamptz,
  fetched_at    timestamptz not null default now(),
  needs_response boolean not null default false,
  created_at    timestamptz not null default now()
);
create unique index reviews_source_external_key on reviews (source_id, external_id);
create index reviews_tenant_posted_idx on reviews (tenant_id, posted_at desc);
create index reviews_location_rating_idx on reviews (location_id, rating, posted_at desc);
create index reviews_needs_response_idx on reviews (tenant_id, posted_at desc) where needs_response;

create table review_requests (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  location_id   uuid references tenant_locations(id) on delete set null,
  contact_id    uuid not null references contacts(id) on delete cascade,
  channel       text not null default 'whatsapp'
                  check (channel in ('whatsapp','sms','email')),
  status        text not null default 'pending'
                  check (status in ('pending','sent','delivered','clicked','reviewed','failed','suppressed')),
  review_id     uuid references reviews(id) on delete set null,
  send_after    timestamptz,
  sent_at       timestamptz,
  clicked_at    timestamptz,
  failure_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index review_requests_tenant_status_idx on review_requests (tenant_id, status, send_after);
create index review_requests_contact_idx on review_requests (contact_id, created_at desc);

create table review_responses (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  review_id    uuid not null references reviews(id) on delete cascade,
  body         text not null,
  is_ai_drafted boolean not null default false,
  status       text not null default 'draft'
                 check (status in ('draft','approved','published','rejected')),
  approved_by  uuid references profiles(id) on delete set null,
  approved_at  timestamptz,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index review_responses_review_idx on review_responses (review_id);

-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'websites','nap_audits','citations','review_responses','review_requests'
  ] loop
    execute format(
      'create trigger %I before update on %I
         for each row execute function app.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;
