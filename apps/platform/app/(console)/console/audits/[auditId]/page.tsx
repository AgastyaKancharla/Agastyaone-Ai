import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { AuditStatusPill, ScoreCard, STATUS_MEANING } from '@/components/nap';

export default async function AuditDetail({ params }: { params: Promise<{ auditId: string }> }) {
  const { auditId } = await params;
  const supabase = await createClient();

  const { data: audit } = await supabase
    .from('nap_audits')
    .select(`
      id, tenant_id, location_id, status, audit_score, coverage_pct,
      directories_requested, directories_checked, directories_errored,
      ambiguous_count, created_at, completed_at, error_message,
      tenant_locations ( name, city ),
      nap_source_of_truth ( version, business_name, address_line1, locality, city, pincode, phone_e164, website )
    `)
    .eq('id', auditId)
    .maybeSingle();

  if (!audit) notFound();

  const { data: results } = await supabase
    .from('nap_audit_results')
    .select(`
      id, directory_code, status, listing_url, found, match_confidence,
      runner_up_margin, overall_confidence, error_message,
      nap_field_diffs ( field_name, source_value, found_value, match_status, similarity_score, notes )
    `)
    .eq('audit_id', auditId)
    .order('directory_code');

  const location = audit.tenant_locations as unknown as { name: string; city: string | null } | null;
  const sot = audit.nap_source_of_truth as unknown as { version: number; business_name: string | null } | null;

  return (
    <>
      <PageHeader
        title={`Listings audit — ${location?.name ?? 'location'}`}
        description={`${new Date(audit.created_at).toLocaleString('en-IN')} · checked against source-of-truth version ${sot?.version ?? '?'}`}
        action={
          <Link href={`/console/clients/${audit.tenant_id}/nap/${audit.location_id}`} className="btn-secondary">
            Back
          </Link>
        }
      />

      <div className="p-8 space-y-8 max-w-5xl">
        {audit.status !== 'completed' ? (
          <div className="card p-8">
            <div className="flex items-center gap-3">
              <AuditStatusPill status={audit.status} />
              <span className="text-sm text-muted">
                {audit.status === 'queued' && 'Waiting for a worker to pick this up.'}
                {audit.status === 'running' && 'In progress — directories are being checked.'}
                {audit.status === 'failed' && (audit.error_message ?? 'The run failed.')}
              </span>
            </div>
          </div>
        ) : (
          <>
            <ScoreCard
              score={audit.audit_score}
              coverage={audit.coverage_pct}
              errored={audit.directories_errored}
            />

            {audit.ambiguous_count > 0 && (
              <div className="card p-5 border-accent/30 bg-accent/5">
                <h3 className="font-medium text-sm">
                  {audit.ambiguous_count} listing{audit.ambiguous_count > 1 ? 's' : ''} need a human decision
                </h3>
                <p className="hint">
                  A listing was found but could not be confidently attributed to this business — usually
                  a duplicate listing or a similarly-named competitor nearby. Nothing is reported to the
                  client for these, because showing someone else&apos;s address as their error is worse
                  than showing nothing.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {(results ?? []).map((r) => {
                const diffs = (r.nap_field_diffs ?? []) as {
                  field_name: string; source_value: string | null; found_value: string | null;
                  match_status: string; similarity_score: number | null; notes: string | null;
                }[];

                return (
                  <section key={r.id} className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-hairline flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-medium capitalize">{r.directory_code.replace('_', ' ')}</h3>
                          <AuditStatusPill status={r.status} />
                        </div>
                        <p className="hint">{STATUS_MEANING[r.status] ?? ''}</p>
                        {r.error_message && <p className="hint text-danger">{r.error_message}</p>}
                      </div>
                      <div className="text-right shrink-0 text-xs text-muted space-y-0.5">
                        {r.match_confidence !== null && <div>match {r.match_confidence}%</div>}
                        {r.overall_confidence !== null && <div>agreement {r.overall_confidence}%</div>}
                        {r.listing_url && (
                          <a href={r.listing_url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline block">
                            View listing ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {diffs.length > 0 ? (
                      <table className="w-full">
                        <thead className="bg-brand-wash border-b border-hairline">
                          <tr>
                            <th className="th">Field</th>
                            <th className="th">Yours</th>
                            <th className="th">Published</th>
                            <th className="th">Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {diffs.map((d) => (
                            <tr key={d.field_name}>
                              <td className="td capitalize text-muted whitespace-nowrap">
                                {d.field_name.replace('_', ' ')}
                              </td>
                              <td className="td">{d.source_value ?? <span className="text-muted">—</span>}</td>
                              <td className="td">
                                {d.found_value ?? <span className="text-muted">not published</span>}
                              </td>
                              <td className="td">
                                <AuditStatusPill status={d.match_status} />
                                {d.notes && <div className="hint">{d.notes}</div>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-6 py-5 text-sm text-muted">
                        {r.status === 'ambiguous'
                          ? 'Field detail withheld — this listing could not be confidently attributed.'
                          : 'No field detail for this directory.'}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
