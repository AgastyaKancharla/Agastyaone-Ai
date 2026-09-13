'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ServiceState = { error?: string; ok?: string };

/**
 * The catalog is global, not tenant-scoped -- these RLS-write to
 * service_catalog/service_components/service_deliverables under
 * app.is_staff() alone, the same as every other write here, just without a
 * tenant_id in the mix.
 */
export async function createService(_prev: ServiceState, formData: FormData): Promise<ServiceState> {
  const code = String(formData.get('code') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const isBundle = formData.get('is_bundle') === 'on';
  const defaultPrice = String(formData.get('default_price') ?? '').trim();
  const billingCycle = String(formData.get('billing_cycle') ?? 'monthly');
  const defaultHsnSac = String(formData.get('default_hsn_sac') ?? '').trim();
  const defaultGstRate = Number(formData.get('default_gst_rate') ?? 18);
  const sortOrder = Number(formData.get('sort_order') ?? 0);
  const status = String(formData.get('status') ?? 'draft');

  if (!code) return { error: 'Give this service a short code, e.g. "ai_scribe".' };
  if (!name) return { error: 'Give this service a name.' };

  const supabase = await createClient();
  const { data: service, error } = await supabase
    .from('service_catalog')
    .insert({
      code,
      name,
      category,
      description: description || null,
      is_bundle: isBundle,
      default_price: defaultPrice ? Number(defaultPrice) : null,
      billing_cycle: billingCycle,
      default_hsn_sac: defaultHsnSac || null,
      default_gst_rate: defaultGstRate,
      sort_order: sortOrder,
      status,
    })
    .select('id')
    .single();

  if (error || !service) {
    return { error: error?.message.includes('duplicate') ? `Code "${code}" is already in use.` : error?.message ?? 'Could not create the service.' };
  }

  revalidatePath('/console/services');
  redirect(`/console/services/${service.id}`);
}

export async function updateService(_prev: ServiceState, formData: FormData): Promise<ServiceState> {
  const serviceId = String(formData.get('service_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const defaultPrice = String(formData.get('default_price') ?? '').trim();
  const billingCycle = String(formData.get('billing_cycle') ?? 'monthly');
  const defaultHsnSac = String(formData.get('default_hsn_sac') ?? '').trim();
  const defaultGstRate = Number(formData.get('default_gst_rate') ?? 18);
  const sortOrder = Number(formData.get('sort_order') ?? 0);
  const status = String(formData.get('status') ?? 'draft');

  if (!name) return { error: 'Give this service a name.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('service_catalog')
    .update({
      name,
      category,
      description: description || null,
      default_price: defaultPrice ? Number(defaultPrice) : null,
      billing_cycle: billingCycle,
      default_hsn_sac: defaultHsnSac || null,
      default_gst_rate: defaultGstRate,
      sort_order: sortOrder,
      status,
    })
    .eq('id', serviceId);

  if (error) return { error: error.message };

  revalidatePath('/console/services');
  revalidatePath(`/console/services/${serviceId}`);
  return { ok: 'Saved.' };
}

/**
 * Bundles are exactly one level deep everywhere else this schema assumes
 * that (app.rebuild_tenant_entitlements expands a bundle's children but
 * never a child's own children) -- so a bundle can never be added as
 * another bundle's component. The picker already filters these out; this
 * is the server-side backstop.
 */
export async function addServiceComponent(_prev: ServiceState, formData: FormData): Promise<ServiceState> {
  const parentServiceId = String(formData.get('parent_service_id') ?? '');
  const childServiceId = String(formData.get('child_service_id') ?? '');

  if (!childServiceId) return { error: 'Pick a service to add.' };
  if (childServiceId === parentServiceId) return { error: 'A bundle cannot include itself.' };

  const supabase = await createClient();

  const { data: child } = await supabase.from('service_catalog').select('is_bundle').eq('id', childServiceId).maybeSingle();
  if (child?.is_bundle) return { error: 'A bundle cannot include another bundle.' };

  const { count } = await supabase
    .from('service_components')
    .select('*', { count: 'exact', head: true })
    .eq('parent_service_id', parentServiceId);

  const { error } = await supabase.from('service_components').insert({
    parent_service_id: parentServiceId,
    child_service_id: childServiceId,
    sort_order: count ?? 0,
  });

  if (error) return { error: error.message.includes('duplicate') ? 'Already included.' : error.message };

  revalidatePath(`/console/services/${parentServiceId}`);
  return { ok: 'Added.' };
}

export async function removeServiceComponent(formData: FormData): Promise<void> {
  const parentServiceId = String(formData.get('parent_service_id') ?? '');
  const childServiceId = String(formData.get('child_service_id') ?? '');

  const supabase = await createClient();
  await supabase
    .from('service_components')
    .delete()
    .eq('parent_service_id', parentServiceId)
    .eq('child_service_id', childServiceId);

  revalidatePath(`/console/services/${parentServiceId}`);
}

export async function addServiceDeliverable(_prev: ServiceState, formData: FormData): Promise<ServiceState> {
  const serviceId = String(formData.get('service_id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const cadence = String(formData.get('cadence') ?? 'monthly');

  if (!name) return { error: 'Give this deliverable a name.' };

  const supabase = await createClient();
  const { count } = await supabase
    .from('service_deliverables')
    .select('*', { count: 'exact', head: true })
    .eq('service_id', serviceId);

  const { error } = await supabase.from('service_deliverables').insert({
    service_id: serviceId,
    name,
    description: description || null,
    cadence,
    sort_order: count ?? 0,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/services/${serviceId}`);
  return { ok: 'Added.' };
}

export async function removeServiceDeliverable(formData: FormData): Promise<void> {
  const serviceId = String(formData.get('service_id') ?? '');
  const deliverableId = String(formData.get('deliverable_id') ?? '');

  const supabase = await createClient();
  await supabase.from('service_deliverables').delete().eq('id', deliverableId);

  revalidatePath(`/console/services/${serviceId}`);
}
