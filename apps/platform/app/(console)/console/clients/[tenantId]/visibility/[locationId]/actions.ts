'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type VisibilityState = { error?: string; ok?: string };

export async function runVisibilityAudit(
  _prev: VisibilityState,
  formData: FormData,
): Promise<VisibilityState> {
  const locationId = String(formData.get('location_id') ?? '');
  const tenantId = String(formData.get('tenant_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('enqueue_visibility_audit', { p_location_id: locationId });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/visibility/${locationId}`);
  return { ok: 'Queued. A worker will pick it up; results appear below when it finishes.' };
}
