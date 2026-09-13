import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { InvoiceStatusPill } from '@/components/commercial';
import { formatINR } from '@/lib/india';

export default async function InvoicesListPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase.from('tenants').select('id, name').eq('id', tenantId).maybeSingle();
  if (!tenant) notFound();

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, status, issue_date, due_date, total_amount, amount_received')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title={`${tenant.name} — invoices`}
        description="Generated from a contract's active lines. Numbered only once marked issued."
        action={
          <Link href={`/console/clients/${tenantId}/invoices/new`} className="btn-primary">
            Generate invoice
          </Link>
        }
      />

      <div className="p-8 max-w-4xl">
        {(invoices ?? []).length === 0 ? (
          <EmptyState
            title="No invoices yet"
            description="Generate one from any active contract's currently-active lines."
            action={
              <Link href={`/console/clients/${tenantId}/invoices/new`} className="btn-primary">
                Generate invoice
              </Link>
            }
          />
        ) : (
          <section className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Number</th>
                  <th className="th">Issue date</th>
                  <th className="th">Due</th>
                  <th className="th">Status</th>
                  <th className="th">Total</th>
                  <th className="th">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(invoices ?? []).map((inv) => (
                  <tr key={inv.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td">
                      <Link
                        href={`/console/clients/${tenantId}/invoices/${inv.id}`}
                        className="text-brand hover:underline text-xs font-mono"
                      >
                        {inv.invoice_number ?? 'unissued'}
                      </Link>
                    </td>
                    <td className="td text-sm">
                      {new Date(inv.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="td text-sm text-muted">
                      {inv.due_date
                        ? new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td className="td"><InvoiceStatusPill status={inv.status} /></td>
                    <td className="td tabular-nums">{formatINR(inv.total_amount)}</td>
                    <td className="td tabular-nums text-muted">{formatINR(inv.amount_received)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <p className="text-sm text-muted mt-6">
          <Link href={`/console/clients/${tenantId}`} className="text-brand hover:underline">
            ← Back to client
          </Link>
        </p>
      </div>
    </>
  );
}
