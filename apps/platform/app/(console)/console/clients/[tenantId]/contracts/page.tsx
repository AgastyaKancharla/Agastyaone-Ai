import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { ContractStatusPill, CONTRACT_TYPE_LABEL } from '@/components/commercial';
import { formatINR } from '@/lib/india';

export default async function ContractsListPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) notFound();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, reference, type, title, status, commercial_model, total_value, currency_code, starts_on, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title={`${tenant.name} — contracts`}
        description="MSAs, statements of work and change requests. Signing one is what switches a service on."
        action={
          <Link href={`/console/clients/${tenantId}/contracts/new`} className="btn-primary">
            New contract
          </Link>
        }
      />

      <div className="p-8 max-w-4xl">
        {(contracts ?? []).length === 0 ? (
          <EmptyState
            title="No contracts yet"
            description="Nothing is entitled until a contract line is signed and active. Create the first one to start selling this client something."
            action={
              <Link href={`/console/clients/${tenantId}/contracts/new`} className="btn-primary">
                New contract
              </Link>
            }
          />
        ) : (
          <section className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Reference</th>
                  <th className="th">Title</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(contracts ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td">
                      <Link
                        href={`/console/clients/${tenantId}/contracts/${c.id}`}
                        className="text-brand hover:underline text-xs font-mono"
                      >
                        {c.reference ?? 'unsent'}
                      </Link>
                    </td>
                    <td className="td text-sm">
                      <Link href={`/console/clients/${tenantId}/contracts/${c.id}`} className="hover:underline">
                        {c.title}
                      </Link>
                    </td>
                    <td className="td text-xs text-muted">{CONTRACT_TYPE_LABEL[c.type] ?? c.type}</td>
                    <td className="td"><ContractStatusPill status={c.status} /></td>
                    <td className="td tabular-nums">{formatINR(c.total_value)}</td>
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
