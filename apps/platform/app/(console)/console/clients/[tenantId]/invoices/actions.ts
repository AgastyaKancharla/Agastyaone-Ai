'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { computeCreditNote, computeInvoice, type BillableLine } from '@agastyaone/billing-engine';

export type InvoiceState = { error?: string; ok?: string };

const revalidate = (tenantId: string) => {
  revalidatePath(`/console/clients/${tenantId}/invoices`);
};

/**
 * Composes an invoice from a contract's currently-active lines. The GST math
 * runs once, here, via @agastyaone/billing-engine, and every computed number
 * is written straight onto the invoice/invoice_lines rows -- nothing about an
 * issued invoice is ever recomputed later, matching how a real tax invoice
 * works (correct it with a credit note, don't rewrite it).
 */
export async function generateInvoice(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const contractId = String(formData.get('contract_id') ?? '');
  const periodStart = String(formData.get('period_start') ?? '').trim();
  const periodEnd = String(formData.get('period_end') ?? '').trim();
  const issueDate = String(formData.get('issue_date') ?? '').trim() || new Date().toISOString().slice(0, 10);
  const dueDate = String(formData.get('due_date') ?? '').trim();

  if (!contractId) return { error: 'Pick a contract to invoice.' };

  const supabase = await createClient();

  const [{ data: tenant }, { data: issuer }, { data: lines }] = await Promise.all([
    supabase.from('tenants').select('id, gstin, place_of_supply').eq('id', tenantId).maybeSingle(),
    supabase.from('tenants').select('id, gstin, place_of_supply').eq('is_internal', true).maybeSingle(),
    supabase
      .from('contract_lines')
      .select(
        'id, description, hsn_sac_code, quantity, unit_price, discount_pct, gst_rate, service_id, service_catalog ( name )',
      )
      .eq('contract_id', contractId)
      .eq('status', 'active'),
  ]);

  if (!tenant) return { error: 'Client not found.' };
  if (!tenant.place_of_supply) {
    return { error: "This client's place of supply (GST state) is not set yet — add it before generating an invoice." };
  }
  if (!issuer?.place_of_supply) {
    return { error: "AgastyaOne's own place of supply is not on file — cannot determine intra vs. inter-state GST." };
  }
  if (!lines || lines.length === 0) {
    return { error: 'This contract has no active line items to invoice.' };
  }

  const billable: BillableLine[] = lines.map((l) => ({
    id: l.id,
    description: (l.service_catalog as { name: string } | null)?.name ?? l.description ?? 'Service',
    hsnSacCode: l.hsn_sac_code,
    quantity: Number(l.quantity),
    unitPrice: Number(l.unit_price),
    discountPct: Number(l.discount_pct),
    gstRate: Number(l.gst_rate),
    serviceId: l.service_id,
  }));

  const isInterstate = issuer.place_of_supply !== tenant.place_of_supply;
  const { lines: computedLines, totals } = computeInvoice(billable, isInterstate);

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      issuer_tenant_id: issuer.id,
      contract_id: contractId,
      status: 'draft',
      issue_date: issueDate,
      due_date: dueDate || null,
      supplier_state_code: issuer.place_of_supply,
      place_of_supply: tenant.place_of_supply,
      supplier_gstin: issuer.gstin,
      customer_gstin: tenant.gstin,
      taxable_amount: totals.taxableAmount,
      discount_amount: totals.discountAmount,
      cgst_amount: totals.cgstAmount,
      sgst_amount: totals.sgstAmount,
      igst_amount: totals.igstAmount,
      total_tax: totals.totalTax,
      round_off: totals.roundOff,
      total_amount: totals.totalAmount,
    })
    .select('id')
    .single();

  if (invoiceError || !invoice) return { error: invoiceError?.message ?? 'Could not create the invoice.' };

  const { error: linesError } = await supabase.from('invoice_lines').insert(
    computedLines.map((l, idx) => ({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      service_id: l.serviceId,
      description: l.description,
      hsn_sac_code: l.hsnSacCode,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      discount_amount: l.discountAmount,
      taxable_amount: l.taxableAmount,
      gst_rate: l.gstRate,
      cgst_amount: l.cgstAmount,
      sgst_amount: l.sgstAmount,
      igst_amount: l.igstAmount,
      line_total: l.lineTotal,
      period_start: periodStart || null,
      period_end: periodEnd || null,
      sort_order: idx,
    })),
  );

  if (linesError) {
    // An invoice header with no lines explains nothing -- undo it rather
    // than leave a broken draft behind.
    await supabase.from('invoices').delete().eq('id', invoice.id);
    return { error: linesError.message };
  }

  revalidate(tenantId);
  redirect(`/console/clients/${tenantId}/invoices/${invoice.id}`);
}

/**
 * draft -> issued burns the gapless number (via the invoices_assign_number
 * trigger, 0035) and is the only forward step from draft. issued -> cancelled
 * is the correction path for "we issued this by mistake" before any payment
 * exists; part_paid/paid/written_off are driven by recording a payment, not a
 * button here.
 */
const NEXT_STATUS: Record<string, string[]> = {
  draft: ['issued'],
  issued: ['cancelled'],
};

export async function updateInvoiceStatus(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const invoiceId = String(formData.get('invoice_id') ?? '');
  const currentStatus = String(formData.get('current_status') ?? '');
  const nextStatus = String(formData.get('next_status') ?? '');

  if (!NEXT_STATUS[currentStatus]?.includes(nextStatus)) {
    throw new Error(`Cannot move an invoice from ${currentStatus} to ${nextStatus}.`);
  }

  const supabase = await createClient();
  await supabase.from('invoices').update({ status: nextStatus }).eq('id', invoiceId);

  revalidatePath(`/console/clients/${tenantId}/invoices`);
  revalidatePath(`/console/clients/${tenantId}/invoices/${invoiceId}`);
}

/**
 * Payments are never edited here -- the invoice's amount_received and status
 * are recomputed from the full set of payments by a DB trigger
 * (app.recalculate_invoice_payment_status, 0036), so recording one is a
 * plain insert with no local bookkeeping to keep in sync.
 */
export async function recordPayment(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const invoiceId = String(formData.get('invoice_id') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const tdsAmount = Number(formData.get('tds_amount') ?? 0);
  const method = String(formData.get('method') ?? 'upi');
  const reference = String(formData.get('reference') ?? '').trim();
  const receivedOn = String(formData.get('received_on') ?? '').trim() || new Date().toISOString().slice(0, 10);
  const notes = String(formData.get('notes') ?? '').trim();

  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter a payment amount greater than zero.' };
  if (!Number.isFinite(tdsAmount) || tdsAmount < 0) return { error: 'TDS amount must be zero or more.' };

  const supabase = await createClient();

  const { data: invoice } = await supabase.from('invoices').select('status').eq('id', invoiceId).maybeSingle();
  if (!invoice || !['issued', 'part_paid'].includes(invoice.status)) {
    return { error: 'Payments can only be recorded against an issued invoice.' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('payments').insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    amount,
    tds_amount: tdsAmount,
    method,
    reference: reference || null,
    received_on: receivedOn,
    notes: notes || null,
    recorded_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/invoices`);
  revalidatePath(`/console/clients/${tenantId}/invoices/${invoiceId}`);
  return { ok: 'Payment recorded.' };
}

/**
 * Scales the invoice's own tax breakdown down to the credited portion
 * (@agastyaone/billing-engine's computeCreditNote) rather than re-deriving
 * GST -- correct even when the invoice mixed line items at different rates.
 * Starts as a draft, same as a contract or invoice: credit_note_number is
 * assigned by app.assign_credit_note_number (0036) only once this is marked
 * issued.
 */
export async function issueCreditNote(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const invoiceId = String(formData.get('invoice_id') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const creditTaxableAmount = Number(formData.get('taxable_amount') ?? 0);

  if (!reason) return { error: 'Say why this invoice is being credited.' };
  if (!Number.isFinite(creditTaxableAmount) || creditTaxableAmount <= 0) {
    return { error: 'Enter a taxable amount to credit, greater than zero.' };
  }

  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, issuer_tenant_id, status, issue_date, taxable_amount, cgst_amount, sgst_amount, igst_amount')
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice || !['issued', 'part_paid', 'paid'].includes(invoice.status)) {
    return { error: 'Only an issued invoice can be credited.' };
  }

  const { data: existingCredits } = await supabase
    .from('credit_notes')
    .select('taxable_amount')
    .eq('invoice_id', invoiceId)
    .neq('status', 'cancelled');

  const alreadyCredited = (existingCredits ?? []).reduce((sum, c) => sum + Number(c.taxable_amount), 0);
  const remaining = Number(invoice.taxable_amount) - alreadyCredited;

  if (creditTaxableAmount > remaining + 0.01) {
    return { error: `This invoice has at most ${remaining.toFixed(2)} left to credit.` };
  }

  const computed = computeCreditNote(
    {
      taxableAmount: Number(invoice.taxable_amount),
      cgstAmount: Number(invoice.cgst_amount),
      sgstAmount: Number(invoice.sgst_amount),
      igstAmount: Number(invoice.igst_amount),
    },
    creditTaxableAmount,
  );

  const { error } = await supabase.from('credit_notes').insert({
    tenant_id: tenantId,
    issuer_tenant_id: invoice.issuer_tenant_id,
    invoice_id: invoiceId,
    reason,
    status: 'draft',
    issue_date: new Date().toISOString().slice(0, 10),
    taxable_amount: computed.taxableAmount,
    cgst_amount: computed.cgstAmount,
    sgst_amount: computed.sgstAmount,
    igst_amount: computed.igstAmount,
    total_amount: computed.totalAmount,
  });

  if (error) return { error: error.message };

  revalidatePath(`/console/clients/${tenantId}/invoices/${invoiceId}`);
  return { ok: 'Credit note drafted.' };
}

const CREDIT_NOTE_NEXT_STATUS: Record<string, string[]> = {
  draft: ['issued'],
  issued: ['cancelled'],
};

export async function updateCreditNoteStatus(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const invoiceId = String(formData.get('invoice_id') ?? '');
  const creditNoteId = String(formData.get('credit_note_id') ?? '');
  const currentStatus = String(formData.get('current_status') ?? '');
  const nextStatus = String(formData.get('next_status') ?? '');

  if (!CREDIT_NOTE_NEXT_STATUS[currentStatus]?.includes(nextStatus)) {
    throw new Error(`Cannot move a credit note from ${currentStatus} to ${nextStatus}.`);
  }

  const supabase = await createClient();
  await supabase.from('credit_notes').update({ status: nextStatus }).eq('id', creditNoteId);

  revalidatePath(`/console/clients/${tenantId}/invoices/${invoiceId}`);
}
