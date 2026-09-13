'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type BacklinksState = { error?: string; ok?: string };

export async function runBacklinksCheck(_prev: BacklinksState, formData: FormData): Promise<BacklinksState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('enqueue_backlinks_check', { p_location_id: locationId });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/backlinks/${locationId}`);
  return { ok: 'Queued. A worker picks it up; the result appears below once it finishes.' };
}
