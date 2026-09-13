'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type AiVisibilityState = { error?: string; ok?: string };

const revalidate = (tenantId: string, locationId: string) =>
  revalidatePath(`/console/clients/${tenantId}/ai-visibility/${locationId}`);

export async function addPrompt(_prev: AiVisibilityState, formData: FormData): Promise<AiVisibilityState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const prompt = String(formData.get('prompt') ?? '').trim();

  if (!prompt) return { error: 'Enter the question a patient might actually ask.' };
  if (prompt.length > 300) return { error: 'That prompt is too long to be a realistic question.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('geo_prompts')
    .insert({ tenant_id: tenantId, location_id: locationId, prompt });

  if (error) return { error: error.message };

  revalidate(tenantId, locationId);
  return { ok: 'Prompt added.' };
}

export async function removePrompt(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');
  const id = String(formData.get('prompt_id') ?? '');

  const supabase = await createClient();
  await supabase.from('geo_prompts').delete().eq('id', id);
  revalidate(tenantId, locationId);
}

export async function runChecks(_prev: AiVisibilityState, formData: FormData): Promise<AiVisibilityState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const locationId = String(formData.get('location_id') ?? '');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('enqueue_geo_runs', { p_location_id: locationId });

  if (error) return { error: error.message };

  revalidate(tenantId, locationId);
  const count = typeof data === 'number' ? data : 0;
  return {
    ok: `Queued ${count} check${count === 1 ? '' : 's'}. A worker picks them up; results appear below as each finishes.`,
  };
}
