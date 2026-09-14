'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { placesClient } from '@agastyaone/places-client';
import { slugify } from '@/lib/india';

export type ProspectState = { error?: string; ok?: string };

/** A search phrase people actually type, and a question they'd ask an AI assistant, when staff didn't type their own. */
const VERTICAL_NOUN: Record<string, string> = {
  dental: 'dentist',
  clinic: 'clinic',
  retail: 'store',
  services: 'business',
  other: 'business',
};

/**
 * Everything a prospect needs before Express/Deep audits can run against it,
 * in one submission. tenants.status defaults to 'prospect' in the schema
 * (0002) -- it has just never been assigned by any code path until now, so
 * this is the first thing that actually uses it.
 */
export async function createProspect(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const name = String(formData.get('name') ?? '').trim();
  const vertical = String(formData.get('vertical') ?? 'dental');
  const city = String(formData.get('city') ?? '').trim();
  const addressLine1 = String(formData.get('address_line1') ?? '').trim();
  const website = String(formData.get('website') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const placeId = String(formData.get('gbp_place_id') ?? '').trim();
  const searchPhrase = String(formData.get('search_phrase') ?? '').trim();
  const question = String(formData.get('question') ?? '').trim();

  if (!name) return { error: 'Business name is required.' };

  const supabase = await createClient();
  const notes: string[] = [];

  // Generated here rather than left to the column default, and the insert
  // below deliberately has no .select(): RLS's SELECT policy for 'all'-scope
  // staff computes accessible tenant ids by querying tenants itself, and a
  // row this same INSERT just created is not yet visible to that check when
  // Postgres re-evaluates it for a RETURNING clause -- the write succeeds,
  // reading the just-written row back in the same statement does not.
  // Already knowing the id sidesteps that instead of fighting it.
  const tenantId = crypto.randomUUID();
  const { error: tenantError } = await supabase
    .from('tenants')
    .insert({ id: tenantId, name, slug: slugify(name), vertical, status: 'prospect', place_of_supply: '29' });

  if (tenantError) {
    return {
      error: tenantError.code === '23505'
        ? 'A business with a very similar name is already tracked.'
        : tenantError.message,
    };
  }

  // Same reasoning as the client-creation flow: without this, a staff member
  // on 'assigned' scope loses sight of the prospect they just made.
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('profile_id', (await supabase.auth.getUser()).data.user!.id)
    .maybeSingle();
  if (staff) {
    await supabase.from('account_assignments').insert({
      tenant_id: tenantId,
      staff_id: staff.id,
      role: 'account_manager',
      status: 'active',
    });
  }

  const { data: location, error: locationError } = await supabase
    .from('tenant_locations')
    .insert({
      tenant_id: tenantId,
      name: `${name} — main`,
      is_primary: true,
      address_line1: addressLine1 || null,
      city: city || null,
      phone_e164: phone || null,
    })
    .select('id')
    .single();

  if (locationError || !location) {
    return { error: `Prospect created, but its location could not be added: ${locationError?.message}` };
  }
  const locationId = location.id;

  if (placeId) {
    const { error: sourceError } = await supabase.rpc('create_review_source', {
      p_location_id: locationId,
      p_platform: 'google',
      p_external_id: placeId,
    });
    if (sourceError) {
      notes.push(`Google place could not be connected: ${sourceError.message}`);
    } else {
      const result = await placesClient().getPlaceSummary(placeId);
      if (result.status === 'ok' && result.summary.latitude !== null && result.summary.longitude !== null) {
        await supabase
          .from('tenant_locations')
          .update({
            latitude: result.summary.latitude,
            longitude: result.summary.longitude,
            geo_source: 'google_place',
            geo_updated_at: new Date().toISOString(),
          })
          .eq('id', locationId);
      } else {
        notes.push('Connected, but coordinates could not be read from Google yet — sync them on the Map rank page before scanning.');
      }
    }
  } else {
    notes.push('No Google place connected — add one before running map-rank, or ranking will be skipped.');
  }

  await supabase.rpc('set_nap_source_of_truth', {
    p_location_id: locationId,
    p_business_name: name,
    ...(website ? { p_website: website } : {}),
    ...(phone ? { p_phone_raw: phone } : {}),
    ...(addressLine1 ? { p_address_line1: addressLine1 } : {}),
    ...(city ? { p_city: city } : {}),
  });

  const noun = VERTICAL_NOUN[vertical] ?? 'business';
  const defaultSearch = city ? `${noun} near ${city}` : noun;
  const defaultQuestion = city ? `best ${noun} in ${city}` : `best ${noun}`;

  await supabase.from('map_keywords').insert({
    tenant_id: tenantId,
    location_id: locationId,
    phrase: searchPhrase || defaultSearch,
  });

  await supabase.from('geo_prompts').insert({
    tenant_id: tenantId,
    location_id: locationId,
    prompt: question || defaultQuestion,
  });

  revalidatePath('/console/prospects');
  redirect(`/console/prospects/${tenantId}${notes.length ? `?note=${encodeURIComponent(notes.join(' '))}` : ''}`);
}

/**
 * Builds the result state from what actually ran. Under
 * exactOptionalPropertyTypes an explicit `ok: undefined` is not the same as
 * omitting the key, so this only sets a key when there is something to say.
 */
function summarize(queued: string[], skipped: string[]): ProspectState {
  const state: ProspectState = {};
  if (queued.length) state.ok = `Queued: ${queued.join(', ')}.`;
  if (skipped.length) state.error = `Skipped: ${skipped.join('; ')}.`;
  return state;
}

async function locationFor(tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenant_locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_primary', true)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Express: NAP + a light map-rank pass (5x5 -- a quarter of Deep's 81
 * points, still enough to show local-pack position) so a first-touch check
 * stays fast and cheap. Both are best-effort: a missing prerequisite (no
 * source of truth, no coordinates) is reported back, not thrown, so the
 * other one still runs.
 */
export async function runExpressAudit(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = await locationFor(tenantId);
  if (!locationId) return { error: 'No location on file for this prospect.' };

  const supabase = await createClient();
  const queued: string[] = [];
  const skipped: string[] = [];

  const { error: napError } = await supabase.rpc('enqueue_nap_audit', { p_location_id: locationId });
  if (napError) skipped.push(`NAP: ${napError.message}`);
  else queued.push('NAP audit');

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('latitude, longitude')
    .eq('id', locationId)
    .maybeSingle();

  if (location?.latitude === null || location?.latitude === undefined) {
    skipped.push('Map rank: no coordinates — connect a Google place first');
  } else {
    const { data, error } = await supabase.rpc('enqueue_map_scans', {
      p_location_id: locationId,
      p_grid_size: 5,
      p_spacing_m: 800,
    });
    if (error) skipped.push(`Map rank: ${error.message}`);
    else queued.push(`map rank (${typeof data === 'number' ? data : 0} scan grid)`);
  }

  revalidatePath(`/console/prospects/${tenantId}`);
  return summarize(queued, skipped);
}

/** Deep: every pillar. Same graceful-skip behaviour as Express. */
export async function runDeepAudit(_prev: ProspectState, formData: FormData): Promise<ProspectState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = await locationFor(tenantId);
  if (!locationId) return { error: 'No location on file for this prospect.' };

  const supabase = await createClient();
  const queued: string[] = [];
  const skipped: string[] = [];

  const { error: napError } = await supabase.rpc('enqueue_nap_audit', { p_location_id: locationId });
  if (napError) skipped.push(`NAP: ${napError.message}`);
  else queued.push('NAP audit');

  const { error: visError } = await supabase.rpc('enqueue_visibility_audit', { p_location_id: locationId });
  if (visError) skipped.push(`Website: ${visError.message}`);
  else queued.push('website audit');

  const { error: backError } = await supabase.rpc('enqueue_backlinks_check', { p_location_id: locationId });
  if (backError) skipped.push(`Backlinks: ${backError.message}`);
  else queued.push('backlinks check');

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('latitude, longitude')
    .eq('id', locationId)
    .maybeSingle();

  if (location?.latitude === null || location?.latitude === undefined) {
    skipped.push('Map rank: no coordinates — connect a Google place first');
  } else {
    const { data, error } = await supabase.rpc('enqueue_map_scans', {
      p_location_id: locationId,
      p_grid_size: 9,
      p_spacing_m: 800,
    });
    if (error) skipped.push(`Map rank: ${error.message}`);
    else queued.push(`map rank (${typeof data === 'number' ? data : 0} scan full grid)`);
  }

  const { data: geoData, error: geoError } = await supabase.rpc('enqueue_geo_runs', { p_location_id: locationId });
  if (geoError) skipped.push(`AI visibility: ${geoError.message}`);
  else queued.push(`AI visibility (${typeof geoData === 'number' ? geoData : 0} checks)`);

  revalidatePath(`/console/prospects/${tenantId}`);
  return summarize(queued, skipped);
}

/**
 * A status change, nothing more -- every audit already run stays attached to
 * the same tenant row, so nothing is re-entered once a prospect signs.
 */
export async function convertToClient(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const supabase = await createClient();
  await supabase.from('tenants').update({ status: 'onboarding' }).eq('id', tenantId);
  revalidatePath('/console/prospects');
  redirect(`/console/clients/${tenantId}`);
}
