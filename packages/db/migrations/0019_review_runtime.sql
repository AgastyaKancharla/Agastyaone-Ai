-- =============================================================================
-- 0019_review_runtime
--
-- The review request loop, on the one channel that needs no approval from
-- anybody: a link and a QR code the front desk hands over as the patient leaves.
--
-- WhatsApp is the channel patients actually read, but it is blocked on Meta
-- business verification and template approval; SMS in India additionally needs
-- DLT registration with TRAI. Both are weeks away and neither is in our hands.
-- A printed QR is not a lesser version of those — for a dental clinic it is the
-- moment with the highest intent, when the patient is standing at the desk
-- having just been treated.
--
-- What this migration deliberately does NOT do:
--
--   * It does not write to `reviews`. Google Places data may be shown live with
--     attribution but not warehoused, so the ratings this service displays are
--     fetched per request and stored nowhere. `reviews` is the destination for
--     owner-authorised GBP API data later, which carries no such restriction.
--   * It does not attribute a posted review to a patient. Google does not say
--     who wrote a review, and guessing would repeat the retired NAP tool's
--     "first search hit as gospel" defect in a place a client would notice. We
--     record what we actually observe: a link was issued, a link was scanned.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- The channel vocabulary was written before the delivery decision was made, so
-- it cannot express the channel that ships first. This is exactly the case the
-- "text + CHECK, never a Postgres enum" decision was taken for: a one-line
-- constraint swap instead of a type migration with a rewrite behind it.
-- ---------------------------------------------------------------------------
alter table public.review_requests drop constraint if exists review_requests_channel_check;
alter table public.review_requests add constraint review_requests_channel_check
  check (channel in ('link', 'whatsapp', 'sms', 'email'));

alter table public.review_requests alter column channel set default 'link';

-- The token appears in a URL a patient can see, so it has to be unguessable and
-- non-enumerable. gen_random_uuid() is core since PG13 and draws from
-- pg_strong_random(), so this is 122 bits of CSPRNG output with no extension
-- dependency to reproduce in CI.
alter table public.review_requests add column if not exists public_token text;

create unique index if not exists review_requests_public_token_key
  on public.review_requests (public_token) where public_token is not null;

comment on column public.review_requests.public_token is
  'Unguessable token embedded in the patient-facing review link. Null for channels that do not use one.';


-- ===========================================================================
-- create_review_source — point a location at its Google (or other) listing.
--
-- `external_id` holds the Google place ID. Place IDs are the one thing Maps
-- Platform terms allow to be cached indefinitely; the rating and review text
-- that come back against it are not, which is why nothing else from Places is
-- persisted anywhere in this schema.
-- ===========================================================================
create or replace function public.create_review_source(
  p_location_id uuid,
  p_platform    text default 'google',
  p_profile_url text default null,
  p_external_id text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_source_id uuid;
begin
  if not app.is_staff() then
    raise exception 'Only staff can connect a review source' using errcode = '42501';
  end if;

  if p_platform not in ('google', 'practo', 'justdial', 'facebook', 'other') then
    raise exception 'Unknown review platform: %', p_platform using errcode = '22023';
  end if;

  select l.tenant_id into v_tenant_id
  from public.tenant_locations l
  where l.id = p_location_id
    and l.tenant_id = any (app.accessible_tenant_ids());

  if v_tenant_id is null then
    raise exception 'Location not found or not accessible' using errcode = '42501';
  end if;

  if coalesce(btrim(p_profile_url), '') = '' and coalesce(btrim(p_external_id), '') = '' then
    raise exception 'A review source needs either a profile URL or an external id'
      using errcode = '22023';
  end if;

  insert into public.review_sources (tenant_id, location_id, platform, profile_url, external_id)
  values (v_tenant_id, p_location_id, p_platform,
          nullif(btrim(p_profile_url), ''), nullif(btrim(p_external_id), ''))
  on conflict (location_id, platform) do update
     set profile_url = coalesce(excluded.profile_url, public.review_sources.profile_url),
         external_id = coalesce(excluded.external_id, public.review_sources.external_id),
         is_active   = true
  returning id into v_source_id;

  return v_source_id;
end;
$$;

revoke execute on function public.create_review_source(uuid, text, text, text) from public, anon;
grant  execute on function public.create_review_source(uuid, text, text, text) to authenticated;


-- ===========================================================================
-- issue_review_request — THE CONSENT GATE.
--
-- It lives here, in the one function every channel must pass through, and it is
-- written now while the only channel is one that does not need it. That is the
-- point: when WhatsApp is finally approved it will be wired into this function
-- and meet the check already standing, rather than someone remembering to add
-- one under deadline.
--
-- Under the DPDP Act AgastyaOne is a Data Processor for the clinic's patient
-- data, and Meta requires opt-in provenance for template messages. An imported
-- patient list carries neither — `consent_source = 'import'` is a record of
-- where the row came from, not of anyone agreeing to be messaged. So imported
-- contacts can be handed a QR code all day and cannot be messaged at all until
-- a real opt-in is captured through set_contact_consent.
-- ===========================================================================
create or replace function public.issue_review_request(
  p_contact_id uuid,
  p_source_id  uuid,
  p_channel    text default 'link'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_tenant_id  uuid;
  v_location   uuid;
  v_opt_in     timestamptz;
  v_opt_out    timestamptz;
  v_token      text;
  v_status     text;
  v_request_id uuid;
begin
  if not app.is_staff() then
    raise exception 'Only staff can issue review requests' using errcode = '42501';
  end if;

  if p_channel not in ('link', 'whatsapp', 'sms', 'email') then
    raise exception 'Unknown channel: %', p_channel using errcode = '22023';
  end if;

  select c.tenant_id,
         case p_channel when 'whatsapp' then c.whatsapp_opt_in_at
                        when 'sms'      then c.sms_opt_in_at
                        when 'email'    then c.email_opt_in_at end,
         case p_channel when 'whatsapp' then c.whatsapp_opt_out_at
                        when 'sms'      then c.sms_opt_out_at
                        when 'email'    then c.email_opt_out_at end
    into v_tenant_id, v_opt_in, v_opt_out
  from public.contacts c
  where c.id = p_contact_id
    and c.tenant_id = any (app.accessible_tenant_ids())
    and c.status = 'active';

  if v_tenant_id is null then
    raise exception 'Contact not found or not accessible' using errcode = '42501';
  end if;

  -- The source must belong to the SAME tenant as the contact. Without this a
  -- caller could point one clinic's patient at another clinic's review page.
  select s.location_id into v_location
  from public.review_sources s
  where s.id = p_source_id and s.tenant_id = v_tenant_id and s.is_active;

  if v_location is null then
    raise exception 'Review source not found for that contact''s tenant' using errcode = '42501';
  end if;

  -- Messaging a patient requires a live opt-in for that specific channel.
  -- Handing someone a QR code at the desk is not messaging them, so 'link' is
  -- deliberately not gated — but it is the ONLY channel that is not.
  if p_channel <> 'link' then
    if v_opt_in is null then
      raise exception 'No % opt-in recorded for this contact', p_channel using errcode = '42501';
    end if;
    if v_opt_out is not null and v_opt_out >= v_opt_in then
      raise exception 'This contact has opted out of %', p_channel using errcode = '42501';
    end if;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');

  -- A link is 'sent' the moment it exists: it has been produced and handed to
  -- the front desk, and nothing downstream will ever move it on. A message is
  -- 'pending' until something actually sends it, which is the outbox's job.
  v_status := case when p_channel = 'link' then 'sent' else 'pending' end;

  insert into public.review_requests
    (tenant_id, location_id, contact_id, channel, status, public_token, sent_at)
  values
    (v_tenant_id, v_location, p_contact_id, p_channel, v_status, v_token,
     case when p_channel = 'link' then now() end)
  returning id into v_request_id;

  return jsonb_build_object('request_id', v_request_id, 'token', v_token, 'status', v_status);
end;
$$;

revoke execute on function public.issue_review_request(uuid, uuid, text) from public, anon;
grant  execute on function public.issue_review_request(uuid, uuid, text) to authenticated;


-- ===========================================================================
-- record_review_click — the one function `anon` may execute.
--
-- `anon` holds USAGE on the public schema but no privilege on a single table,
-- so it is refused before RLS is even consulted. This is a deliberate, narrow
-- exception to that, because the patient scanning the QR is not logged in and
-- never will be.
--
-- Narrowed so the exception stays safe:
--   * takes a 122-bit random token and nothing else — no ids to enumerate
--   * returns ONLY a destination URL; no contact, tenant or request data
--   * writes only clicked_at and one status transition
--   * an unknown token returns null rather than an error, so it cannot be used
--     to probe which tokens exist
--   * first click wins, so a QR scanned twice at the desk does not inflate the
--     funnel the clinic is shown
-- ===========================================================================
create or replace function public.record_review_click(p_token text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;

  update public.review_requests r
     set clicked_at = coalesce(r.clicked_at, now()),
         status     = case when r.status in ('pending', 'sent') then 'clicked' else r.status end
   where r.public_token = p_token
  returning (select s.profile_url
             from public.review_sources s
             where s.location_id = r.location_id
               and s.platform = 'google'
               and s.is_active
             limit 1)
    into v_url;

  return v_url;
end;
$$;

revoke execute on function public.record_review_click(text) from public;
grant  execute on function public.record_review_click(text) to anon, authenticated;

comment on function public.record_review_click(text) is
  'Records a QR/link scan and returns the destination. The only function anon may execute.';
