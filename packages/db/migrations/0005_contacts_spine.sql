-- =============================================================================
-- 0005_contacts_spine  (L3 spine)
-- The hub every service attaches to. A call, a booking, a review request, a
-- WhatsApp thread and a recall reminder all resolve to the same contact --
-- otherwise the platform is ten silos sharing a login.
--
-- Consent fields exist from the first row. Lifecycle messaging over WhatsApp
-- needs opt-in provenance (Meta policy) and lawful basis (DPDP Act, where
-- AgastyaOne is a Data Processor for the clinic's patient data). Consent cannot
-- be invented retroactively, which makes this the one gap on the schema that is
-- a legal dead end rather than a migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Normalisation lives in Postgres, not TypeScript. One import script or webhook
-- handler that skips it inserts '+91 98765 43210' alongside '9876543210' and
-- the duplicate is permanent.
--
-- E.164, not bare digits: an 11-digit landline or a single international
-- patient breaks the bare form, and that is precisely a reshape-live-data
-- event.
-- -----------------------------------------------------------------------------
create or replace function app.normalize_phone_e164(p_raw text, p_default_cc text default '91')
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
  v_trimmed text;
begin
  if p_raw is null then return null; end if;
  v_trimmed := btrim(p_raw);
  v_digits  := regexp_replace(v_trimmed, '[^0-9]', '', 'g');
  if v_digits = '' then return null; end if;

  if left(v_trimmed, 1) = '+' then
    return '+' || v_digits;
  end if;
  if left(v_digits, 2) = '00' then
    return '+' || substring(v_digits from 3);
  end if;
  -- Indian trunk prefix: 0 + 10 digits
  if length(v_digits) = 11 and left(v_digits, 1) = '0' then
    return '+' || p_default_cc || substring(v_digits from 2);
  end if;
  if length(v_digits) = 12 and left(v_digits, 2) = '91' then
    return '+' || v_digits;
  end if;
  if length(v_digits) = 10 then
    return '+' || p_default_cc || v_digits;
  end if;
  return '+' || v_digits;
end;
$$;

create or replace function app.normalize_identity(p_type text, p_raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_raw is null or btrim(p_raw) = '' then return null; end if;
  return case p_type
    when 'phone_e164' then app.normalize_phone_e164(p_raw)
    when 'wa_id'      then app.normalize_phone_e164(p_raw)
    when 'email'      then lower(btrim(p_raw))
    else btrim(p_raw)
  end;
end;
$$;

-- -----------------------------------------------------------------------------
create table contacts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  location_id   uuid references tenant_locations(id) on delete set null,

  -- Without this, the clinic's own receptionist testing the AI receptionist is
  -- counted as a lead in the pipeline metrics.
  contact_kind  text not null default 'patient'
                  check (contact_kind in ('patient','lead','client_staff','vendor','unknown')),

  full_name     text,
  given_name    text,
  family_name   text,
  primary_phone_raw  text,
  primary_phone_e164 text generated always as (app.normalize_phone_e164(primary_phone_raw)) stored,
  primary_email      citext,
  date_of_birth date,
  notes         text,
  tags          text[] not null default '{}',

  -- Consent. Provenance matters as much as the flag: "who opted this person in,
  -- when, and through what" is the answer Meta and a DPDP audit both want.
  whatsapp_opt_in_at   timestamptz,
  whatsapp_opt_out_at  timestamptz,
  sms_opt_in_at        timestamptz,
  sms_opt_out_at       timestamptz,
  email_opt_in_at      timestamptz,
  email_opt_out_at     timestamptz,
  consent_source       text
                         check (consent_source is null or consent_source in
                           ('booking_form','website_form','in_clinic','whatsapp_inbound',
                            'phone_call','import','api','other')),
  consent_evidence     jsonb not null default '{}'::jsonb,

  -- Merge model: tombstone and repoint, never rewrite fact rows. This is what
  -- makes an unmerge possible.
  merged_into_contact_id uuid references contacts(id) on delete set null,
  canonical_contact_id   uuid,

  status        text not null default 'active'
                  check (status in ('active','archived','merged','deleted')),
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index contacts_tenant_idx on contacts (tenant_id, created_at desc);
create index contacts_tenant_location_idx on contacts (tenant_id, location_id);
create index contacts_tenant_phone_idx on contacts (tenant_id, primary_phone_e164)
  where primary_phone_e164 is not null;
create index contacts_canonical_idx on contacts (canonical_contact_id);
create index contacts_name_trgm_idx on contacts using gin (full_name extensions.gin_trgm_ops);
create index contacts_whatsapp_optin_idx on contacts (tenant_id)
  where whatsapp_opt_in_at is not null and whatsapp_opt_out_at is null;

-- Keep canonical_contact_id resolved to one hop, so reads never need a
-- recursive CTE.
create or replace function app.contacts_maintain_canonical()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.merged_into_contact_id is null then
    new.canonical_contact_id := new.id;
  else
    select coalesce(c.canonical_contact_id, c.id)
      into new.canonical_contact_id
      from public.contacts c where c.id = new.merged_into_contact_id;
    new.status := 'merged';
  end if;
  return new;
end;
$$;
create trigger contacts_canonical
  before insert or update of merged_into_contact_id on contacts
  for each row execute function app.contacts_maintain_canonical();

-- -----------------------------------------------------------------------------
-- Identities. The UNIQUE constraint IS the dedupe design: every channel does an
-- upsert and six simultaneous arrivals converge on one contact because Postgres
-- serialises them on the index. No fuzzy matching, no race, one round trip.
--
-- Scoped per tenant on purpose. Two clinics can legitimately share a patient; a
-- cross-tenant identity graph would be a DPDP incident.
-- -----------------------------------------------------------------------------
create table contact_identities (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  contact_id     uuid not null references contacts(id) on delete cascade,
  identity_type  text not null
                   check (identity_type in ('phone_e164','email','wa_id','gbp_reviewer_id',
                                            'booking_ref','external_crm_id','call_ani')),
  identity_value text not null,
  identity_value_raw text,
  is_verified    boolean not null default false,
  source_service text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);
create unique index contact_identities_key
  on contact_identities (tenant_id, identity_type, identity_value);
create index contact_identities_contact_idx on contact_identities (contact_id);

-- The single entry point every inbound channel uses. Normalises, upserts,
-- creates the contact when new, and always returns the CANONICAL id so callers
-- never attach facts to a merged-away row.
create or replace function app.resolve_contact(
  p_tenant_id        uuid,
  p_identity_type    text,
  p_identity_value   text,
  p_location_id      uuid  default null,
  p_full_name        text  default null,
  p_contact_kind     text  default 'patient',
  p_source_service   text  default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_norm           text := app.normalize_identity(p_identity_type, p_identity_value);
  v_contact_id     uuid;
  v_new_contact_id uuid;
begin
  if v_norm is null then
    raise exception 'resolve_contact: identity value normalised to null (type=%, raw=%)',
      p_identity_type, p_identity_value;
  end if;

  select ci.contact_id into v_contact_id
  from public.contact_identities ci
  where ci.tenant_id = p_tenant_id
    and ci.identity_type = p_identity_type
    and ci.identity_value = v_norm;

  if v_contact_id is null then
    insert into public.contacts (tenant_id, location_id, contact_kind, full_name,
                                 primary_phone_raw, primary_email)
    values (
      p_tenant_id, p_location_id, p_contact_kind, p_full_name,
      case when p_identity_type in ('phone_e164','wa_id','call_ani') then p_identity_value end,
      case when p_identity_type = 'email' then v_norm::citext end
    )
    returning id into v_new_contact_id;

    -- Two concurrent callers can both reach here for the same identity. The
    -- unique index picks one winner; the loser takes the winner's contact_id
    -- and deletes the row it just created, so a race cannot leave an orphan
    -- contact with no identities attached.
    insert into public.contact_identities
      (tenant_id, contact_id, identity_type, identity_value, identity_value_raw, source_service)
    values (p_tenant_id, v_new_contact_id, p_identity_type, v_norm, p_identity_value, p_source_service)
    on conflict (tenant_id, identity_type, identity_value) do update
      set last_seen_at = now()
    returning contact_id into v_contact_id;

    if v_contact_id <> v_new_contact_id then
      delete from public.contacts where id = v_new_contact_id;
    end if;
  else
    update public.contact_identities
       set last_seen_at = now()
     where tenant_id = p_tenant_id
       and identity_type = p_identity_type
       and identity_value = v_norm;

    update public.contacts
       set last_seen_at = now(),
           full_name = coalesce(full_name, p_full_name)
     where id = v_contact_id;
  end if;

  -- Always hand back the canonical row.
  select coalesce(c.canonical_contact_id, c.id) into v_contact_id
  from public.contacts c where c.id = v_contact_id;

  return v_contact_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Merge audit trail. A hard merge that rewrites thousands of rows across eight
-- tables is unrecoverable; this makes the operation reversible.
-- -----------------------------------------------------------------------------
create table contact_merges (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  winner_id  uuid not null references contacts(id) on delete cascade,
  loser_id   uuid not null references contacts(id) on delete cascade,
  reason     text,
  evidence   jsonb not null default '{}'::jsonb,
  merged_by  uuid references profiles(id) on delete set null,
  merged_at  timestamptz not null default now(),
  reverted_at timestamptz,
  check (winner_id <> loser_id)
);
create index contact_merges_tenant_idx on contact_merges (tenant_id, merged_at desc);

-- Probabilistic matches never auto-merge below threshold; they queue for a
-- human. Rejected pairs persist so the same pair is never re-queued -- miss
-- that and staff re-reject weekly until they stop trusting the queue.
create table contact_match_candidates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  contact_a_id uuid not null references contacts(id) on delete cascade,
  contact_b_id uuid not null references contacts(id) on delete cascade,
  score        numeric(4,3) not null check (score between 0 and 1),
  signals      jsonb not null default '{}'::jsonb,
  status       text not null default 'pending'
                 check (status in ('pending','merged','rejected')),
  reviewed_by  uuid references profiles(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  check (contact_a_id <> contact_b_id)
);
-- Order-independent uniqueness, so (A,B) and (B,A) are the same pair.
create unique index contact_match_candidates_pair_key on contact_match_candidates (
  tenant_id,
  least(contact_a_id, contact_b_id),
  greatest(contact_a_id, contact_b_id)
);
create index contact_match_candidates_pending_idx on contact_match_candidates (tenant_id, score desc)
  where status = 'pending';

create trigger contacts_touch before update on contacts
  for each row execute function app.touch_updated_at();
