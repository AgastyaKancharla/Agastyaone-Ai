'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ReviewState = { error?: string; ok?: string };

/**
 * Both go through SECURITY DEFINER RPCs. issue_review_request in particular is
 * where the consent gate lives — this file must not reimplement it, or there
 * would be two versions of the rule and only one of them enforced.
 */
export async function connectPlace(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const placeId = String(formData.get('external_id') ?? '').trim();
  const profileUrl = String(formData.get('profile_url') ?? '').trim();

  if (!placeId && !profileUrl) {
    return { error: 'Paste the Google place ID, the review link, or both.' };
  }

  const optional: Record<string, string> = {};
  if (placeId) optional['p_external_id'] = placeId;
  if (profileUrl) optional['p_profile_url'] = profileUrl;

  const supabase = await createClient();
  const { error } = await supabase.rpc('create_review_source', {
    p_location_id: locationId,
    p_platform: 'google',
    ...optional,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/reviews/${locationId}`);
  return { ok: 'Connected. The rating below is read live from Google.' };
}

export async function issueRequest(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const contactId = String(formData.get('contact_id') ?? '');
  const sourceId = String(formData.get('source_id') ?? '');

  if (!contactId) return { error: 'Choose a patient first.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('issue_review_request', {
    p_contact_id: contactId,
    p_source_id: sourceId,
    p_channel: 'link',
  });

  if (error) return { error: error.message };

  // The token is not returned to the client. Revalidating puts the new code at
  // the top of the list below, with its QR encoded server-side and available
  // again whenever it needs reprinting.
  revalidatePath(`/console/clients/${tenantId}/reviews/${locationId}`);
  return { ok: 'Code created — it is at the top of the list below.' };
}
