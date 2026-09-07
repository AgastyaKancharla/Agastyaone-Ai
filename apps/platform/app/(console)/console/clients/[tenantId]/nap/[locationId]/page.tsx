import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { AuditStatusPill } from '@/components/nap';
import { RunAuditButton, SourceOfTruthForm } from './nap-forms';

export default async function LocationNapPage({
  params,
}: {
  params: Promise<{ tenantId: string; locationId: string }>;
}) {
  const { tenantId, locationId } = await params;
  const supabase = await createClient();

  // RLS scopes all of these; a wrong id returns nothing rather than someone
  // else's clinic.
  const { data: location } = await supabase
    .from('tenant_locations')
    .select('id, name, city, tenant_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!location || location.tenant_id !== tenantId) notFound();

  const [{ data: sot }, { data: audits }] = await Promise.all([
    supabase
      .from('nap_source_of_truth')
      .select('business_name, address_line1, address_line2, locality, city, state, pincode, phone_raw, phone_e164, website, category, version')
      .eq('location_id', locationId)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('nap_audits')
      .select('id, status, audit_score, coverage_pct, directories_checked, directories_errored, consistent_count, drift_count, inconsistent_count, not_found_count, ambiguous_count, created_at, error_message')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <>
      <PageHeader
        title={`${location.name} — listings`}
        description="Name, address and phone consistency across Indian directories."
        action={<RunAuditButton tenantId={tenantId} locationId={locationId} disabled={!sot} />}
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <SourceOfTruthForm tenantId={tenantId} locationId={locationId} sot={sot ?? null} />

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Audit history</h2>
            <p className="hint">Each run records the source-of-truth version it checked against.</p>
          </div>

          {!audits || audits.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted">
              {sot
                ? 'No audits yet. Run one to see how this location appears across directories.'
                : 'Set the source of truth above, then run the first audit.'}
            </p>
          ) : (
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Run</th>
                  <th className="th">Status</th>
                  <th className="th">Score</th>
                  <th className="th">Coverage</th>
                  <th className="th">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {audits.map((a) => (
                  <tr key={a.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td">
                      <Link href={`/console/audits/${a.id}`} className="font-medium hover:text-brand">
                        {new Date(a.created_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </Link>
                    </td>
                    <td className="td"><AuditStatusPill status={a.status} /></td>
                    <td className="td tabular-nums">{a.audit_score ?? '—'}</td>
                    <td className="td tabular-nums">
                      {a.coverage_pct !== null ? `${a.coverage_pct}%` : '—'}
                      {a.directories_errored > 0 && (
                        <span className="text-xs text-muted"> ({a.directories_errored} unreadable)</span>
                      )}
                    </td>
                    <td className="td text-xs text-muted">
                      {a.status === 'completed'
                        ? [
                            a.consistent_count && `${a.consistent_count} consistent`,
                            a.drift_count && `${a.drift_count} drift`,
                            a.inconsistent_count && `${a.inconsistent_count} inconsistent`,
                            a.not_found_count && `${a.not_found_count} not found`,
                            a.ambiguous_count && `${a.ambiguous_count} to review`,
                          ].filter(Boolean).join(' · ') || '—'
                        : a.error_message ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
