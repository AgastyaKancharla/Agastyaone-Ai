import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import {
  BILLING_CYCLE_LABEL,
  COMMERCIAL_MODEL_LABEL,
  CONTRACT_TYPE_LABEL,
  ContractStatusPill,
} from '@/components/commercial';
import { formatINR } from '@/lib/india';
import { endContractLine, updateContractStatus } from '../actions';
import { AddLineForm } from './forms';

const NEXT_STATUS: Record<string, { to: string; label: string; tone?: 'danger' }[]> = {
  draft: [{ to: 'sent', label: 'Mark sent' }],
  sent: [{ to: 'signed', label: 'Mark signed' }, { to: 'draft', label: 'Back to draft' }],
  signed: [{ to: 'active', label: 'Activate' }],
  active: [
    { to: 'completed', label: 'Mark completed' },
    { to: 'terminated', label: 'Terminate', tone: 'danger' },
  ],
};

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; contractId: string }>;
}) {
  const { tenantId, contractId } = await params;
  const supabase = await createClient();

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, tenant_id, reference, type, title, commercial_model, status, total_value, currency_code, starts_on, ends_on, notes')
    .eq('id', contractId)
    .maybeSingle();

  if (!contract || contract.tenant_id !== tenantId) notFound();

  const [{ data: lines }, { data: services }] = await Promise.all([
    supabase
      .from('contract_lines')
      .select('id, service_id, description, hsn_sac_code, quantity, unit_price, discount_pct, gst_rate, billing_cycle, status, starts_on, ends_on, service_catalog ( name )')
      .eq('contract_id', contractId)
      .order('created_at'),
    supabase
      .from('service_catalog')
      .select('id, code, name, default_hsn_sac, default_gst_rate')
      .eq('status', 'active')
      .order('sort_order'),
  ]);

  const nextSteps = NEXT_STATUS[contract.status] ?? [];
  const activeLines = (lines ?? []).filter((l) => l.status === 'active');
  const monthlyValue = activeLines
    .filter((l) => l.billing_cycle === 'monthly')
    .reduce((sum, l) => sum + Number(l.unit_price) * Number(l.quantity) * (1 - Number(l.discount_pct) / 100), 0);

  return (
    <>
      <PageHeader
        title={contract.title}
        description={`${contract.reference ?? 'not yet sent'} · ${CONTRACT_TYPE_LABEL[contract.type] ?? contract.type} · ${COMMERCIAL_MODEL_LABEL[contract.commercial_model] ?? contract.commercial_model}`}
        action={
          <div className="flex items-center gap-2">
            <ContractStatusPill status={contract.status} />
            {nextSteps.map((step) => (
              <form key={step.to} action={updateContractStatus}>
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input type="hidden" name="contract_id" value={contractId} />
                <input type="hidden" name="current_status" value={contract.status} />
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
        {activeLines.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="text-3xl font-semibold tabular-nums">{formatINR(monthlyValue)}</div>
              <div className="text-sm text-muted mt-1">Monthly-cycle lines, active</div>
            </div>
            <div className="card p-5">
              <div className="text-3xl font-semibold tabular-nums">{activeLines.length}</div>
              <div className="text-sm text-muted mt-1">Active line{activeLines.length === 1 ? '' : 's'}</div>
            </div>
          </div>
        )}

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Line items</h2>
            <p className="hint">
              What&rsquo;s actually sold. Signing and activating this contract is what switches these
              services on for the client.
            </p>
          </div>

          {(lines ?? []).length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted">No line items yet.</p>
          ) : (
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Service</th>
                  <th className="th">Qty</th>
                  <th className="th">Unit price</th>
                  <th className="th">Discount</th>
                  <th className="th">GST</th>
                  <th className="th">Cycle</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(lines ?? []).map((l) => (
                  <tr key={l.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td text-sm">
                      {(l.service_catalog as { name: string } | null)?.name ?? '—'}
                      {l.description && <div className="hint">{l.description}</div>}
                    </td>
                    <td className="td tabular-nums">{l.quantity}</td>
                    <td className="td tabular-nums">{formatINR(l.unit_price)}</td>
                    <td className="td tabular-nums">{l.discount_pct > 0 ? `${l.discount_pct}%` : '—'}</td>
                    <td className="td tabular-nums">{l.gst_rate}%</td>
                    <td className="td text-xs text-muted">{BILLING_CYCLE_LABEL[l.billing_cycle] ?? l.billing_cycle}</td>
                    <td className="td">
                      <span className={`pill ${l.status === 'active' ? 'bg-brand-wash text-brand-deep' : 'bg-hairline text-muted'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="td text-right">
                      {l.status === 'active' && (
                        <form action={endContractLine}>
                          <input type="hidden" name="tenant_id" value={tenantId} />
                          <input type="hidden" name="contract_id" value={contractId} />
                          <input type="hidden" name="line_id" value={l.id} />
                          <button type="submit" className="text-xs text-muted hover:text-danger">
                            End
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="px-6 py-5 border-t border-hairline">
            <AddLineForm tenantId={tenantId} contractId={contractId} services={services ?? []} />
          </div>
        </section>

        <p className="text-sm text-muted">
          <Link href={`/console/clients/${tenantId}/contracts`} className="text-brand hover:underline">
            ← All contracts
          </Link>
        </p>
      </div>
    </>
  );
}
