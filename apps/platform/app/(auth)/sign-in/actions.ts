'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { siteOrigin } from '@/lib/site';

export type SignInState = { error?: string; sent?: boolean };

/**
 * Both methods are offered to everyone on purpose.
 *
 * Looking up whether an address belongs to a staff member before authenticating
 * would tell an anonymous visitor which emails exist in the system. Offering
 * both and letting the wrong one simply fail leaks nothing.
 */
export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Deliberately generic: never distinguish "no such user" from "wrong password".
  if (error) return { error: 'That email and password combination is not recognised.' };

  redirect('/');
}

export async function signInWithMagicLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Enter your email address.' };

  // Same helper every other outbound link uses. The raw `origin` header is not
  // always present on a Server Action POST, and an empty one makes this a
  // relative URL that Supabase discards in favour of the project's Site URL.
  const origin = await siteOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: 'Could not send the link. Try again in a moment.' };

  // Always reports success, whether or not the address exists — same reason.
  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
