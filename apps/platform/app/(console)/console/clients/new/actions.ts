'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/india';

export type CreateState = { error?: string };

export async function createTenant(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const name = String(formData.get('name') ?? '').trim();
  const vertical = String(formData.get('vertical') ?? 'dental');
  const placeOfSupply = String(formData.get('place_of_supply') ?? '').trim();
  const gstin = String(formData.get('gstin') ?? '').trim().toUpperCase();
  const billingEmail = String(formData.get('billing_email') ?? '').trim();
  const locationName = String(formData.get('location_name') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const addressLine1 = String(formData.get('address_line1') ?? '').trim();
  const pincode = String(formData.get('pincode') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!name) return { error: 'Business name is required.' };
  if (!placeOfSupply) return { error: 'Place of supply is required — it decides CGST/SGST vs IGST on every invoice.' };
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
    return { error: 'That GSTIN does not look valid. Leave it blank if you do not have it yet.' };
  }
  if (gstin && gstin.slice(0, 2) !== placeOfSupply) {
    return { error: `GSTIN starts with ${gstin.slice(0, 2)} but place of supply is ${placeOfSupply}. They must match.` };
  }

  const supabase = await createClient();

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name,
      slug: slugify(name),
      legal_name: String(formData.get('legal_name') ?? '').trim() || null,
      vertical,
      status: 'onboarding',
      place_of_supply: placeOfSupply,
      gstin: gstin || null,
      billing_email: billingEmail || null,
    })
    .select('id')
    .single();

  if (tenantError || !tenant) {
    return {
      error: tenantError?.code === '23505'
        ? 'An account with a very similar name already exists.'
        : tenantError?.message ?? 'Could not create the account.',
    };
  }

  // Assign the creator to the account they just made.
  //
  // Without this, a staff member on 'assigned' scope would create an account
  // and immediately lose sight of it — accessible_tenant_ids() only returns
  // assigned tenants for them, so even the next insert below would fail. Staff
  // on 'all' scope do not need it, but the row is still the honest record of
  // who owns the relationship.
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('profile_id', (await supabase.auth.getUser()).data.user!.id)
    .maybeSingle();

  if (staff) {
    await supabase.from('account_assignments').insert({
      tenant_id: tenant.id,
      staff_id: staff.id,
      role: 'account_manager',
      status: 'active',
    });
  }

  if (locationName || city) {
    const { error: locError } = await supabase.from('tenant_locations').insert({
      tenant_id: tenant.id,
      name: locationName || `${name} — main`,
      is_primary: true,
      address_line1: addressLine1 || null,
      city: city || null,
      state_code: placeOfSupply,
      pincode: pincode || null,
      phone_e164: phone || null,
    });
    // The account exists either way; a failed location is recoverable from the
    // detail page, so this does not roll the whole thing back.
    if (locError) {
      redirect(`/console/clients/${tenant.id}?warn=location`);
    }
  }

  revalidatePath('/console/clients');
  redirect(`/console/clients/${tenant.id}`);
}
