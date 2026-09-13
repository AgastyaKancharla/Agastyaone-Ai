-- =============================================================================
-- 0037_prospecting
--
-- app.create_review_source (0019) only ever wrote to review_sources. Nothing
-- in the app has ever written tenant_locations.gbp_place_id -- confirmed by
-- reading every call site before touching this: the map-rank page's own
-- syncCoordinates action reads that column expecting a connected place to
-- have set it (its own comment says as much), but no code path ever did.
-- That made "connect a place on the Reviews page" and "sync coordinates on
-- the Map rank page" two disconnected steps for every location, prospect or
-- client, not just the ones this slice adds.
--
-- Fixed at the source: connecting a Google place now sets both, in one
-- write, for anyone who calls this RPC -- past clients included.
-- =============================================================================

create or replace function public.create_review_source(
  p_location_id uuid,
  p_platform    text default 'google',
  p_profile_url text default null,
  p_external_id text default null
)
returns uuid
language plpgsql
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

  if p_platform = 'google' and coalesce(btrim(p_external_id), '') <> '' then
    update public.tenant_locations
    set gbp_place_id = btrim(p_external_id)
    where id = p_location_id;
  end if;

  return v_source_id;
end;
$$;
