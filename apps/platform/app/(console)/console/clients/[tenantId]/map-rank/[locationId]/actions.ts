'use server';

import { revalidatePath } from 'next/cache';
import { placesClient } from '@agastyaone/places-client';
import { createClient } from '@/lib/supabase/server';

export type MapRankState = { error?: string; ok?: string };

const revalidate = (tenantId: string, locationId: string) =>
  revalidatePath(`/console/clients/${tenantId}/map-rank/${locationId}`);

export async function addKeyword(_prev: MapRankState, formData: FormData): Promise<MapRankState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const phrase = String(formData.get('phrase') ?? '').trim();

  if (!phrase) return { error: 'Enter a search phrase.' };
  if (phrase.length > 120) return { error: 'That phrase is too long to be a real search.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('map_keywords')
    .insert({ tenant_id: tenantId, location_id: locationId, phrase });

  if (error) {
    return {
      error: error.code === '23505' ? 'That phrase is already being tracked.' : error.message,
    };
  }

  revalidate(tenantId, locationId);
  return { ok: `Now tracking “${phrase}”.` };
}

export async function removeKeyword(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const id = String(formData.get('keyword_id') ?? '');

  const supabase = await createClient();
  await supabase.from('map_keywords').delete().eq('id', id);
  revalidate(tenantId, locationId);
}

/**
 * Take the clinic's coordinates from its connected Google place.
 *
 * A grid needs a centre, and until now nothing in this app ever wrote
 * tenant_locations.latitude/longitude. Google already knows exactly where it
 * thinks the clinic is — which is also the point its own rankings are computed
 * against — so asking it is both the least work and the most correct answer.
 */
export async function syncCoordinates(_prev: MapRankState, formData: FormData): Promise<MapRankState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');

  const supabase = await createClient();
  const { data: location } = await supabase
    .from('tenant_locations')
    .select('gbp_place_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!location?.gbp_place_id) {
    return { error: 'No Google place is connected yet. Connect one on the Reviews page, or set the coordinates by hand below.' };
  }

  const result = await placesClient().getPlaceSummary(location.gbp_place_id);
  if (result.status !== 'ok') {
    return {
      error:
        result.status === 'not_configured'
          ? 'The Google Places key is not configured on this deployment.'
          : 'Google could not be reached for that place just now. Try again, or set the coordinates by hand.',
    };
  }

  const { latitude, longitude } = result.summary;
  if (latitude === null || longitude === null) {
    return { error: 'Google returned no coordinate for that place. Set them by hand below.' };
  }

  const { error } = await supabase
    .from('tenant_locations')
    .update({
      latitude,
      longitude,
      geo_source: 'google_place',
      geo_updated_at: new Date().toISOString(),
    })
    .eq('id', locationId);

  if (error) return { error: error.message };

  revalidate(tenantId, locationId);
  return { ok: `Centre set from Google: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.` };
}

export async function setCoordinatesManually(
  _prev: MapRankState,
  formData: FormData,
): Promise<MapRankState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const latitude = Number(formData.get('latitude'));
  const longitude = Number(formData.get('longitude'));

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { error: 'Latitude must be between -90 and 90.' };
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'Longitude must be between -180 and 180.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_locations')
    .update({
      latitude,
      longitude,
      // Recorded as manual so a later re-sync from Google cannot silently
      // overwrite a pin someone corrected on purpose.
      geo_source: 'manual',
      geo_updated_at: new Date().toISOString(),
    })
    .eq('id', locationId);

  if (error) return { error: error.message };

  revalidate(tenantId, locationId);
  return { ok: 'Centre set by hand.' };
}

export async function runMapScans(_prev: MapRankState, formData: FormData): Promise<MapRankState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('enqueue_map_scans', {
    p_location_id: locationId,
    p_grid_size: 9,
    p_spacing_m: 800,
  });

  if (error) return { error: error.message };

  revalidate(tenantId, locationId);
  const count = typeof data === 'number' ? data : 0;
  return {
    ok: `Queued ${count} scan${count === 1 ? '' : 's'}. A worker picks them up; results appear below when each finishes.`,
  };
}
