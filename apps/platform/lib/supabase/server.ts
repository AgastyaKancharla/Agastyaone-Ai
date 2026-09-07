import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from '@agastyaone/db/types';
import { cookies } from 'next/headers';

/**
 * The user-scoped Supabase client. This is the default everywhere in the app.
 *
 * Every query made through it runs as the signed-in user, so RLS decides what
 * comes back. That means a forgotten `.eq('tenant_id', …)` in application code
 * is a missing filter, not a data leak — the database still refuses to return
 * another tenant's rows.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options ?? {}),
            );
          } catch {
            // Server Components cannot set cookies. Session refresh happens in
            // middleware, so this is safe to swallow rather than crash a render.
          }
        },
      },
    },
  );
}
