'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Ask the client for something.
 *
 * Waiting on the client is the largest single source of delay in agency
 * delivery, and it is almost always tracked in someone's head or a WhatsApp
 * thread. Recording it makes two things possible: the client sees it the moment
 * they log in, and `blocked_days` becomes the receipt at renewal for where the
 * time actually went.
 *
 * Staff-only by RLS — client_action_items requires app.is_staff() to insert.
 */
export async function createActionItem(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from('client_action_items').insert({
    tenant_id: tenantId,
    title,
    description: String(formData.get('description') ?? '').trim() || null,
    category: String(formData.get('category') ?? 'access'),
    priority: String(formData.get('priority') ?? 'normal'),
    due_on: String(formData.get('due_on') ?? '') || null,
    requested_by: user?.id ?? null,
  });

  revalidatePath(`/console/clients/${tenantId}`);
}
