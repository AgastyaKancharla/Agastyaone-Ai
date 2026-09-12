'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/session';

export type ChangePasswordState = { error?: string; success?: boolean };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Fill in all three fields.' };
  }
  if (newPassword !== confirmPassword) {
    return { error: 'New password and confirmation do not match.' };
  }

  const session = await getSession();
  if (!session) return { error: 'Your session has expired. Sign in again.' };

  const supabase = await createClient();

  // Re-verify against the current password rather than trusting the live
  // session alone -- an unattended, still-signed-in browser should not be
  // enough on its own to take over the account.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: currentPassword,
  });
  if (verifyError) return { error: 'Current password is incorrect.' };

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) return { error: updateError.message };

  return { success: true };
}
