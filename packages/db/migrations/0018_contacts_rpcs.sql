-- =============================================================================
-- 0018_contacts_rpcs
--
-- Makes the contacts spine usable, and fixes two defects found the moment
-- anything actually called it. `contacts` is the join point for every service
-- line after this one, so both are cheaper to fix now than after ten services
-- depend on the behaviour.
--
-- DEFECT 1 — app.resolve_contact has never worked.
--
--   It is pinned to `search_path = ''` (correctly), and its INSERT contains
--   `v_norm::citext`. citext lives in the `extensions` schema, so the type is
--   unresolvable and the statement fails to parse at execution time. plpgsql
--   parses the whole statement regardless of which CASE branch is taken, so
--   this fires on the phone path too, not just the email one:
--
--     ERROR: type "citext" does not exist
--     CONTEXT: PL/pgSQL function app.resolve_contact(...) line 19
--
--   Written in 0005, never called until now, so nothing surfaced it. The same
--   mistake was made and fixed once already in 0017.
--
-- DEFECT 2 — it is SECURITY DEFINER, takes p_tenant_id as a parameter, never
--   checks app.accessible_tenant_ids(), and carries the default ACL. Combined
--   with `authenticated` holding USAGE on the `app` schema, the only thing
--   standing between a logged-in client and a contact written into another
--   tenant is PostgREST's exposed-schema list. That is a configuration setting,
--   not a security boundary, and it is the wrong thing to be relying on.
--
--   The four foundation helpers in 0001 are explicitly revoked from public and
--   anon; this one was missed. It stays SECURITY DEFINER (it must write
--   contacts and contact_identities while RLS is forced) and stays without an
--   internal tenancy check (the worker calls it with a tenant id it derived
--   server-side, and re-checking would break that). Instead it becomes
--   unreachable from the API, and every caller-facing entry point below does
--   the tenancy check before delegating to it.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Defect 1: the cast.
--
-- CREATE OR REPLACE is safe here — unlike app.normalize_phone_e164, which 0010
-- had to reach with ALTER FUNCTION because contacts.primary_phone_e164 is a
-- STORED generated column that depends on it. Nothing depends on this one.
-- ---------------------------------------------------------------------------
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
      -- Schema-qualified: search_path is empty and citext is in `extensions`.
      case when p_identity_type = 'email' then v_norm::extensions.citext end
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

-- ---------------------------------------------------------------------------
-- Defect 2: the grants, matching 0001:158-165.
-- ---------------------------------------------------------------------------
revoke execute on function app.resolve_contact(uuid, text, text, uuid, text, text, text) from public, anon;
grant  execute on function app.resolve_contact(uuid, text, text, uuid, text, text, text) to service_role;

-- The normalisers are pure and harmless, but leaving them on PUBLIC while
-- revoking their caller invites the question of why. Same treatment.
revoke execute on function app.normalize_identity(text, text)    from public, anon;
revoke execute on function app.normalize_phone_e164(text, text)  from public, anon;
grant  execute on function app.normalize_identity(text, text)    to authenticated, service_role;
grant  execute on function app.normalize_phone_e164(text, text)  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- app.attach_identity — the second and subsequent identities on a contact.
--
-- resolve_contact handles the FIRST identity. A patient who gives both a phone
-- and an email needs the second attached to the same contact, and that is
-- where the interesting case lives: the email may already belong to a
-- DIFFERENT contact. Two people share a family email; a clinic typed the same
-- address on two records years apart.
--
-- Never hard-merge (0005's design, and the reason contact_merges exists): a
-- merge that turns out to be wrong is unrecoverable across eight tables. A
-- collision on a unique identity is the strongest merge signal there is, so it
-- goes to contact_match_candidates at score 1.000 for a human to confirm.
-- That queue had no producer before this.
-- ---------------------------------------------------------------------------
create or replace function app.attach_identity(
  p_tenant_id      uuid,
  p_contact_id     uuid,
  p_identity_type  text,
  p_identity_value text,
  p_source_service text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_norm  text := app.normalize_identity(p_identity_type, p_identity_value);
  v_owner uuid;
begin
  if v_norm is null then return; end if;

  select ci.contact_id into v_owner
  from public.contact_identities ci
  where ci.tenant_id = p_tenant_id
    and ci.identity_type = p_identity_type
    and ci.identity_value = v_norm;

  if v_owner is null then
    insert into public.contact_identities
      (tenant_id, contact_id, identity_type, identity_value, identity_value_raw, source_service)
    values (p_tenant_id, p_contact_id, p_identity_type, v_norm, p_identity_value, p_source_service)
    on conflict (tenant_id, identity_type, identity_value) do update set last_seen_at = now();

  elsif v_owner = p_contact_id then
    update public.contact_identities set last_seen_at = now()
     where tenant_id = p_tenant_id
       and identity_type = p_identity_type
       and identity_value = v_norm;

  else
    -- Same identity, two contacts. Queue it; do not decide it.
    insert into public.contact_match_candidates (tenant_id, contact_a_id, contact_b_id, score, signals)
    values (
      p_tenant_id, p_contact_id, v_owner, 1.000,
      jsonb_build_object(
        'reason', 'shared_identity',
        'identity_type', p_identity_type,
        'detail', 'The same ' || p_identity_type || ' is attached to both contacts.'
      )
    )
    on conflict (tenant_id, least(contact_a_id, contact_b_id), greatest(contact_a_id, contact_b_id))
      do nothing;
  end if;
end;
$$;

revoke execute on function app.attach_identity(uuid, uuid, text, text, text) from public, anon;
grant  execute on function app.attach_identity(uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- public.create_contact — the caller-facing entry point.
--
-- This is where tenancy is enforced, because this is the function a browser can
-- reach. p_tenant_id arrives from a form and is therefore hostile until proven
-- otherwise.
--
-- Consent provenance is captured in the same call that creates the contact.
-- Under the DPDP Act, where AgastyaOne is a Data Processor for the clinic's
-- patient data, consent cannot be reconstructed after the fact — so there is
-- deliberately no way to create a contact here without saying where it came
-- from.
-- ---------------------------------------------------------------------------
create or replace function public.create_contact(
  p_tenant_id       uuid,
  p_full_name       text,
  p_phone           text default null,
  p_email           text default null,
  p_location_id     uuid default null,
  p_consent_source  text default 'in_clinic',
  p_consent_evidence jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_contact_id uuid;
begin
  if not app.is_staff() then
    raise exception 'Only staff can create contacts' using errcode = '42501';
  end if;

  if p_tenant_id is null or not (p_tenant_id = any (app.accessible_tenant_ids())) then
    raise exception 'Tenant not found or not accessible' using errcode = '42501';
  end if;

  -- A contact with no identity cannot be resolved, deduplicated or reached. It
  -- would be a row that quietly duplicates on every future import.
  if app.normalize_identity('phone_e164', p_phone) is null
     and app.normalize_identity('email', p_email) is null then
    raise exception 'A contact needs at least a phone number or an email address'
      using errcode = '22023';
  end if;

  if p_location_id is not null
     and not exists (select 1 from public.tenant_locations l
                      where l.id = p_location_id and l.tenant_id = p_tenant_id) then
    raise exception 'Location does not belong to that tenant' using errcode = '42501';
  end if;

  -- Phone is the primary identity where there is one: it is the channel every
  -- later service line reaches the patient on.
  if app.normalize_identity('phone_e164', p_phone) is not null then
    v_contact_id := app.resolve_contact(p_tenant_id, 'phone_e164', p_phone,
                                        p_location_id, p_full_name, 'patient', 'console');
    perform app.attach_identity(p_tenant_id, v_contact_id, 'email', p_email, 'console');
  else
    v_contact_id := app.resolve_contact(p_tenant_id, 'email', p_email,
                                        p_location_id, p_full_name, 'patient', 'console');
  end if;

  update public.contacts c
     set full_name       = coalesce(c.full_name, p_full_name),
         primary_email   = coalesce(c.primary_email, app.normalize_identity('email', p_email)::extensions.citext),
         location_id     = coalesce(c.location_id, p_location_id),
         -- Never downgrade provenance. A contact that already carries in-clinic
         -- consent must not be overwritten to 'import' by a later bulk load.
         consent_source  = coalesce(c.consent_source, p_consent_source),
         consent_evidence = case when c.consent_evidence = '{}'::jsonb
                                 then coalesce(p_consent_evidence, '{}'::jsonb)
                                 else c.consent_evidence end
   where c.id = v_contact_id;

  return v_contact_id;
end;
$$;

revoke execute on function public.create_contact(uuid, text, text, text, uuid, text, jsonb) from public, anon;
grant  execute on function public.create_contact(uuid, text, text, text, uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- public.import_contacts — bulk load, with an exact dry run.
--
-- p_rows is a jsonb array of {full_name, phone, email}.
--
-- p_dry_run runs the identical classification and writes nothing, so the
-- preview the Console shows and the result it gets afterwards are produced by
-- the same code rather than by an estimate that can disagree with reality.
--
-- Classification counts an identity already seen EARLIER IN THIS BATCH as
-- matched, not created — otherwise a file listing the same patient three times
-- under three phone formats would report three new contacts and then create
-- one, and the operator would not know which number to believe.
-- ---------------------------------------------------------------------------
create or replace function public.import_contacts(
  p_tenant_id   uuid,
  p_rows        jsonb,
  p_location_id uuid    default null,
  p_dry_run     boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row        jsonb;
  v_index      integer := 0;
  v_created    integer := 0;
  v_matched    integer := 0;
  v_skipped    integer := 0;
  v_errors     jsonb   := '[]'::jsonb;
  v_seen       text[]  := '{}';
  v_phone      text;
  v_email      text;
  v_type       text;
  v_value      text;
  v_key        text;
  v_known      boolean;
  v_contact_id uuid;
begin
  if not app.is_staff() then
    raise exception 'Only staff can import contacts' using errcode = '42501';
  end if;

  if p_tenant_id is null or not (p_tenant_id = any (app.accessible_tenant_ids())) then
    raise exception 'Tenant not found or not accessible' using errcode = '42501';
  end if;

  if p_location_id is not null
     and not exists (select 1 from public.tenant_locations l
                      where l.id = p_location_id and l.tenant_id = p_tenant_id) then
    raise exception 'Location does not belong to that tenant' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    v_phone := nullif(btrim(coalesce(v_row->>'phone', '')), '');
    v_email := nullif(btrim(coalesce(v_row->>'email', '')), '');

    v_type  := case when app.normalize_identity('phone_e164', v_phone) is not null
                    then 'phone_e164' else 'email' end;
    v_value := case when v_type = 'phone_e164' then v_phone else v_email end;

    if app.normalize_identity(v_type, v_value) is null then
      v_skipped := v_skipped + 1;
      -- Cap the detail. A 10,000-row file of rubbish should report the count
      -- and a usable sample, not return a payload nobody can read.
      if jsonb_array_length(v_errors) < 50 then
        v_errors := v_errors || jsonb_build_object(
          'row', v_index,
          'name', v_row->>'full_name',
          'reason', 'No usable phone number or email address'
        );
      end if;
      continue;
    end if;

    v_value := app.normalize_identity(v_type, v_value);
    v_key   := v_type || ':' || v_value;

    v_known := (v_key = any (v_seen))
      or exists (select 1 from public.contact_identities ci
                  where ci.tenant_id = p_tenant_id
                    and ci.identity_type = v_type
                    and ci.identity_value = v_value);

    if v_known then v_matched := v_matched + 1; else v_created := v_created + 1; end if;
    v_seen := array_append(v_seen, v_key);

    if not p_dry_run then
      v_contact_id := app.resolve_contact(p_tenant_id, v_type, v_value, p_location_id,
                                          nullif(btrim(coalesce(v_row->>'full_name','')), ''),
                                          'patient', 'import');

      if v_type = 'phone_e164' and v_email is not null then
        perform app.attach_identity(p_tenant_id, v_contact_id, 'email', v_email, 'import');
      end if;

      update public.contacts c
         set full_name        = coalesce(c.full_name, nullif(btrim(coalesce(v_row->>'full_name','')), '')),
             primary_email    = coalesce(c.primary_email, app.normalize_identity('email', v_email)::extensions.citext),
             location_id      = coalesce(c.location_id, p_location_id),
             consent_source   = coalesce(c.consent_source, 'import'),
             consent_evidence = case when c.consent_evidence = '{}'::jsonb
                                     then jsonb_build_object('method','bulk_import','imported_at', now())
                                     else c.consent_evidence end
       where c.id = v_contact_id;
    end if;
  end loop;

  return jsonb_build_object(
    'dry_run', p_dry_run,
    'total',   v_index,
    'created', v_created,
    'matched', v_matched,
    'skipped', v_skipped,
    'errors',  v_errors
  );
end;
$$;

revoke execute on function public.import_contacts(uuid, jsonb, uuid, boolean) from public, anon;
grant  execute on function public.import_contacts(uuid, jsonb, uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- public.set_contact_consent — the only writer of the opt-in timestamps.
--
-- Six nullable timestamps on `contacts` mean consent can otherwise be set by
-- any staff UPDATE without recording where it came from. Meta requires opt-in
-- provenance for WhatsApp, and the DPDP Act requires a lawful basis; "the box
-- was ticked" is not evidence if nothing says which box, when, or by whom.
--
-- Opting OUT is deliberately not gated on evidence. A withdrawal must always
-- succeed — making it as hard to record as an opt-in is how suppression lists
-- end up incomplete.
-- ---------------------------------------------------------------------------
create or replace function public.set_contact_consent(
  p_contact_id uuid,
  p_channel    text,
  p_opted_in   boolean,
  p_source     text  default null,
  p_evidence   jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if p_channel not in ('whatsapp', 'sms', 'email') then
    raise exception 'Unknown consent channel: %', p_channel using errcode = '22023';
  end if;

  if not app.is_staff() then
    raise exception 'Only staff can record consent' using errcode = '42501';
  end if;

  select c.tenant_id into v_tenant_id
  from public.contacts c
  where c.id = p_contact_id
    and c.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Contact not found or not accessible' using errcode = '42501';
  end if;

  if p_opted_in and coalesce(btrim(p_source), '') = '' then
    raise exception 'Recording an opt-in requires a consent source' using errcode = '22023';
  end if;

  -- p_channel is whitelisted above, so %I here cannot be anything else.
  execute format(
    'update public.contacts
        set %I = case when $1 then now() else %I end,
            %I = case when $1 then null  else now() end,
            consent_source   = case when $1 then coalesce($2, consent_source) else consent_source end,
            consent_evidence = case when $1 then coalesce($3, consent_evidence) else consent_evidence end
      where id = $4',
    p_channel || '_opt_in_at', p_channel || '_opt_in_at', p_channel || '_opt_out_at'
  )
  using p_opted_in, p_source, p_evidence, p_contact_id;

  return true;
end;
$$;

revoke execute on function public.set_contact_consent(uuid, text, boolean, text, jsonb) from public, anon;
grant  execute on function public.set_contact_consent(uuid, text, boolean, text, jsonb) to authenticated;
