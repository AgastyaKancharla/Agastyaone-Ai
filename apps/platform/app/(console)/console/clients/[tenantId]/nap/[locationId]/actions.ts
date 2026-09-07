'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type NapState = { error?: string; ok?: string };

/**
 * Both actions go through the SECURITY DEFINER RPCs rather than writing tables
 * directly. The RPCs re-check app.accessible_tenant_ids() server-side, so a
 * forged location id in a form post is refused by the database, not by this
 * code.
 */
export async function saveSourceOfTruth(_prev: NapState, formData: FormData): Promise<NapState> {
  const locationId = String(formData.get('location_id') ?? '');
  const tenantId = String(formData.get('tenant_id') ?? '');
  const businessName = String(formData.get('business_name') ?? '').trim();
  if (!businessName) return { error: 'Business name is required — it is what listings are matched against.' };

  // Only send the fields that actually have a value. Under
  // exactOptionalPropertyTypes an explicit `undefined` is not the same as an
  // absent key, and the RPC's params are `?: string` — omitting the key is what
  // lets the SQL DEFAULT NULL apply, which is the intent.
  const optional: Record<string, string> = {};
  for (const field of [
    'address_line1', 'address_line2', 'locality', 'city',
    'state', 'pincode', 'phone_raw', 'website', 'category',
  ] as const) {
    const value = String(formData.get(field) ?? '').trim();
    if (value) optional[`p_${field}`] = value;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_nap_source_of_truth', {
    p_location_id: locationId,
    p_business_name: businessName,
    ...optional,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/nap/${locationId}`);
  return { ok: 'Saved as a new version. Past audits still reference the version they ran against.' };
}

export async function runAudit(_prev: NapState, formData: FormData): Promise<NapState> {
  const locationId = String(formData.get('location_id') ?? '');
  const tenantId = String(formData.get('tenant_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('enqueue_nap_audit', { p_location_id: locationId });

  if (error) {
    return {
      error: error.message.includes('source of truth')
        ? 'Set the source of truth first — there is nothing to audit against.'
        : error.message,
    };
  }

  revalidatePath(`/console/clients/${tenantId}/nap/${locationId}`);
  return { ok: 'Queued. A worker will pick it up; results appear below when it finishes.' };
}
