'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Goes through the RPC rather than updating the table, because RLS cannot
 * restrict WHICH columns an update touches. The function permits exactly one
 * transition — open to completed — so a client can close what we asked of them
 * and nothing else.
 */
export async function completeActionItem(formData: FormData): Promise<void> {
  const id = String(formData.get('item_id') ?? '');
  const supabase = await createClient();
  await supabase.rpc('complete_client_action_item', { p_item_id: id });
  revalidatePath('/portal');
  revalidatePath('/portal/listings');
}
