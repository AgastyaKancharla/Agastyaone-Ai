import { createClient } from '@supabase/supabase-js';

/**
 * SERVICE ROLE CLIENT — BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * `service_role` carries BYPASSRLS, so this client can read and write every
 * tenant's data. One of these reached from a page or a user-facing route
 * defeats all 343 policies at once.
 *
 * It is therefore importable ONLY from `app/api/internal/**` and worker code.
 * That boundary is enforced by `no-restricted-imports` in .eslintrc.json, so
 * a mistake fails the build rather than shipping quietly.
 *
 * Before using it, ask whether the user-scoped client from ./server would do.
 * It almost always would.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
