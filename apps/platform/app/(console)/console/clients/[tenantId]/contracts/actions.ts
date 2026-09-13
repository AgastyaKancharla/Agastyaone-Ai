'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ContractState = { error?: string; ok?: string };

const revalidate = (tenantId: string) => {
  revalidatePath(`/console/clients/${tenantId}/contracts`);
};

export async function createContract(_prev: ContractState, formData: FormData): Promise<ContractState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const type = String(formData.get('type') ?? 'sow');
  const title = String(formData.get('title') ?? '').trim();
  const commercialModel = String(formData.get('commercial_model') ?? 'retainer');
  const startsOn = String(formData.get('starts_on') ?? '').trim();
  const endsOn = String(formData.get('ends_on') ?? '').trim();
  const parentContractId = String(formData.get('parent_contract_id') ?? '').trim();

  if (!title) return { error: 'Give this contract a title.' };

  const supabase = await createClient();
  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      tenant_id: tenantId,
      type,
      title,
      commercial_model: commercialModel,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      parent_contract_id: parentContractId || null,
    })
    .select('id')
    .single();

  if (error || !contract) return { error: error?.message ?? 'Could not create the contract.' };

  revalidate(tenantId);
  redirect(`/console/clients/${tenantId}/contracts/${contract.id}`);
}

/**
 * The only status changes offered from the UI. 'completed' and 'terminated'
 * are end states reached from 'active' only -- skipping straight there from
 * 'draft' would leave a contract with real entitlements and no signed record
 * of why.
 */
const NEXT_STATUS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['signed', 'draft'],
  signed: ['active'],
  active: ['completed', 'terminated'],
};

export async function updateContractStatus(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const contractId = String(formData.get('contract_id') ?? '');
  const currentStatus = String(formData.get('current_status') ?? '');
  const nextStatus = String(formData.get('next_status') ?? '');

  if (!NEXT_STATUS[currentStatus]?.includes(nextStatus)) {
    throw new Error(`Cannot move a contract from ${currentStatus} to ${nextStatus}.`);
  }

  const supabase = await createClient();
  await supabase.from('contracts').update({ status: nextStatus }).eq('id', contractId);

  revalidate(tenantId);
  revalidatePath(`/console/clients/${tenantId}/contracts/${contractId}`);
}

export async function addContractLine(_prev: ContractState, formData: FormData): Promise<ContractState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const contractId = String(formData.get('contract_id') ?? '');
  const serviceId = String(formData.get('service_id') ?? '');
  const description = String(formData.get('description') ?? '').trim();
  const quantity = Number(formData.get('quantity') ?? 1);
  const unitPrice = Number(formData.get('unit_price') ?? 0);
  const discountPct = Number(formData.get('discount_pct') ?? 0);
  const gstRate = Number(formData.get('gst_rate') ?? 18);
  const hsnSac = String(formData.get('hsn_sac_code') ?? '').trim();
  const billingCycle = String(formData.get('billing_cycle') ?? 'monthly');
  const startsOn = String(formData.get('starts_on') ?? '').trim();

  if (!serviceId) return { error: 'Pick a service.' };
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return { error: 'Unit price must be a real number.' };

  const supabase = await createClient();
  const { error } = await supabase.from('contract_lines').insert({
    tenant_id: tenantId,
    contract_id: contractId,
    service_id: serviceId,
    description: description || null,
    hsn_sac_code: hsnSac || null,
    quantity,
    unit_price: unitPrice,
    discount_pct: discountPct,
    gst_rate: gstRate,
    billing_cycle: billingCycle,
    starts_on: startsOn || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/contracts/${contractId}`);
  return { ok: 'Line added.' };
}

/**
 * Soft only. A contract line that has ever billed carries history in
 * invoice_lines; hard-deleting it would make an issued invoice reference a
 * row that no longer explains itself.
 */
export async function endContractLine(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const contractId = String(formData.get('contract_id') ?? '');
  const lineId = String(formData.get('line_id') ?? '');

  const supabase = await createClient();
  await supabase
    .from('contract_lines')
    .update({ status: 'ended', ends_on: new Date().toISOString().slice(0, 10) })
    .eq('id', lineId);

  revalidatePath(`/console/clients/${tenantId}/contracts/${contractId}`);
}
