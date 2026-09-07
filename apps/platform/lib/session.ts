import { cache } from 'react';
import { createClient } from './supabase/server';

export type Workspace = 'console' | 'portal';

export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  status: string;
  health_status: string;
  vertical: string;
  is_internal: boolean;
};

export type Session = {
  userId: string;
  email: string;
  fullName: string;
  workspace: Workspace;
  /** Staff only. 'all' | 'assigned' | 'none' — decides which tenants are visible. */
  tenantScope: string | null;
  /**
   * Every tenant this user may see. Populated by the same rule the database
   * uses, so the UI and RLS cannot disagree about what exists.
   */
  tenants: TenantSummary[];
};

/**
 * Resolves who is signed in and which workspace they belong in.
 *
 * Wrapped in React `cache()` so a page that needs the session in a layout, a
 * header and three components pays for one round trip, not five.
 *
 * Note this reads `tenants` through the ordinary user-scoped client: the list
 * comes back already filtered by RLS. There is no separate "which tenants can
 * you see" query for the app to get wrong.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: staff }, { data: tenants }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, user_type').eq('id', user.id).maybeSingle(),
    supabase.from('staff_members').select('tenant_scope, status').eq('profile_id', user.id).maybeSingle(),
    supabase
      .from('tenants')
      .select('id, slug, name, status, health_status, vertical, is_internal')
      .order('is_internal', { ascending: false })
      .order('name'),
  ]);

  const isStaff = !!staff && staff.status === 'active';

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? '',
    fullName: profile?.full_name || (profile?.email ?? user.email ?? '').split('@')[0] || 'User',
    workspace: isStaff ? 'console' : 'portal',
    tenantScope: staff?.tenant_scope ?? null,
    tenants: (tenants ?? []) as TenantSummary[],
  };
});
