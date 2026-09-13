import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { InvoiceStatusPill } from '@/components/commercial';
import { formatINR, stateName } from '@/lib/india';
import { updateInvoiceStatus } from '../actions';

const NEXT_STATUS: Record<string, { to: string; label: string; tone?: 'danger' }[]> = {
  draft: [{ to: 'issued', label: 'Mark issued' }],
  issued: [{ to: 'cancelled', label: 'Cancel', tone: 'danger' }],
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; invoiceId: string }>;
}) {
  const { tenantId, invoiceId } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      `id, tenant_id, invoice_number, status, issue_date, due_date, currency_code,
       supplier_state_code, place_of_supply, is_interstate, supplier_gstin, customer_gstin,
       taxable_amount, discount_amount, cgst_amount, sgst_amount, igst_amount, total_tax,
       round_off, total_amount, tds_amount, amount_received, notes,
       contracts ( id, reference, title )`,
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (!invoice || invoice.tenant_id !== tenantId) notFound();

  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('id, description, hsn_sac_code, quantity, unit_price, discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, period_start, period_end')
    .eq('invoice_id', invoiceId)
    .order('sort_order');

  const nextSteps = NEXT_STATUS[invoice.status] ?? [];
  const contract = invoice.contracts as { id: string; reference: string | null; title: string } | null;
  const expectedReceipt = Number(invoice.total_amount) - Number(invoice.tds_amount);

  return (
    <>
      <PageHeader
        title={invoice.invoice_number ?? 'Draft invoice'}
        description={`${contract ? `From ${contract.reference ?? contract.title}` : 'No linked contract'} · issued ${new Date(invoice.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        action={
          <div className="flex items-center gap-2">
            <InvoiceStatusPill status={invoice.status} />
            {nextSteps.map((step) => (
              <form key={step.to} action={updateInvoiceStatus}>
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="invoice_id" value={invoiceId} />
                <input type="hidden" name="current_status" value={invoice.status} />
                <input type="hidden" name="next_status" value={step.to} />
                <button type="submit" className={step.tone === 'danger' ? 'btn-secondary text-danger' : 'btn-secondary'}>
                  {step.label}
                </button>
              </form>
            ))}
          </div>
        }
      />

      <div className="p-8 space-y-8 max-w-4xl">
        {invoice.status === 'draft' && (
          <p className="card p-4 text-sm text-accent-deep border-accent/30">
            Draft — not yet numbered. Nothing here is final until you mark it issued.
          </p>
        )}
        {!invoice.supplier_gstin && (
          <p className="card p-4 text-sm text-muted">
            AgastyaOne&rsquo;s own GSTIN isn&rsquo;t on file yet, so it prints blank below. Add it once registered and
            future invoices will carry it.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="text-3xl font-semibold tabular-nums">{formatINR(invoice.total_amount)}</div>
            <div className="text-sm text-muted mt-1">Total amount</div>
          </div>
          <div className="card p-5">
            <div className="text-3xl font-semibold tabular-nums">{formatINR(invoice.total_tax)}</div>
            <div className="text-sm text-muted mt-1">
              {invoice.is_interstate ? 'IGST' : 'CGST + SGST'}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-3xl font-semibold tabular-nums">{formatINR(expectedReceipt)}</div>
            <div className="text-sm text-muted mt-1">Expected receipt{Number(invoice.tds_amount) > 0 ? ' (after TDS)' : ''}</div>
          </div>
        </div>

        <section className="card p-6">
          <h2 className="font-medium mb-4">Tax details</h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-muted">Supplier (AgastyaOne)</div>
              <div>{stateName(invoice.supplier_state_code) ?? invoice.supplier_state_code}</div>
              <div className="font-mono text-xs text-muted mt-0.5">{invoice.supplier_gstin ?? 'GSTIN pending registration'}</div>
            </div>
            <div>
              <div className="text-muted">Place of supply</div>
              <div>{stateName(invoice.place_of_supply) ?? invoice.place_of_supply}</div>
              <div className="font-mono text-xs text-muted mt-0.5">{invoice.customer_gstin ?? 'No GSTIN on file'}</div>
            </div>
          </div>
          <dl className="mt-5 space-y-2 text-sm border-t border-hairline pt-4">
            <div className="flex justify-between"><dt className="text-muted">Taxable amount</dt><dd className="tabular-nums">{formatINR(invoice.taxable_amount)}</dd></div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between"><dt className="text-muted">Discount</dt><dd className="tabular-nums">−{formatINR(invoice.discount_amount)}</dd></div>
            )}
            {invoice.is_interstate ? (
              <div className="flex justify-between"><dt className="text-muted">IGST</dt><dd className="tabular-nums">{formatINR(invoice.igst_amount)}</dd></div>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-muted">CGST</dt><dd className="tabular-nums">{formatINR(invoice.cgst_amount)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">SGST</dt><dd className="tabular-nums">{formatINR(invoice.sgst_amount)}</dd></div>
              </>
            )}
            <div className="flex justify-between"><dt className="text-muted">Round off</dt><dd className="tabular-nums">{formatINR(invoice.round_off)}</dd></div>
            <div className="flex justify-between font-medium border-t border-hairline pt-2"><dt>Total</dt><dd className="tabular-nums">{formatINR(invoice.total_amount)}</dd></div>
          </dl>
        </section>

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Line items</h2>
          </div>
          <table className="w-full">
            <thead className="bg-brand-wash border-b border-hairline">
              <tr>
                <th className="th">Description</th>
                <th className="th">Qty</th>
                <th className="th">Unit price</th>
                <th className="th">Taxable</th>
                <th className="th">GST</th>
                <th className="th">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {(lines ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="td text-sm">
                    {l.description}
                    {l.hsn_sac_code && <div className="hint">HSN/SAC {l.hsn_sac_code}</div>}
                  </td>
                  <td className="td tabular-nums">{l.quantity}</td>
                  <td className="td tabular-nums">{formatINR(l.unit_price)}</td>
                  <td className="td tabular-nums">{formatINR(l.taxable_amount)}</td>
                  <td className="td tabular-nums">{l.gst_rate}%</td>
                  <td className="td tabular-nums font-medium">{formatINR(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="text-sm text-muted">
          <Link href={`/console/clients/${tenantId}/invoices`} className="text-brand hover:underline">
            ← All invoices
          </Link>
        </p>
      </div>
    </>
  );
}
