import { cache } from 'react';
import { createClient } from './supabase/server';

export type Entitlement = { service_code: string; state: string; source: string };

/**
 * Which modules are switched on for a tenant.
 *
 * Reads the flat `tenant_entitlements` projection, so this is one index probe
 * on a primary key rather than a recursive walk of contracts -> lines ->
 * bundle components on every page load. Bundle expansion already happened at
 * write time, in a trigger.
 *
 * Deliberately NOT a security check. RLS answers "is this your data";
 * entitlement answers "did you buy this module". Keeping them apart is why a
 * lapsed subscription hides a nav item instead of erasing a client's history.
 */
export const getEntitlements = cache(async (tenantId: string): Promise<Entitlement[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('tenant_entitlements')
    .select('service_code, state, source')
    .eq('tenant_id', tenantId);
  return (data ?? []) as Entitlement[];
});

export const isEntitled = (entitlements: Entitlement[], code: string) =>
  entitlements.some((e) => e.service_code === code && (e.state === 'active' || e.state === 'trial'));
