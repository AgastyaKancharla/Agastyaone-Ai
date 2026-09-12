import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getEntitlements, isEntitled } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { AuditStatusPill, ComplianceScorePill, ScoreHero, ScoreSparkline } from '@/components/nap';

/** Plain language for what kind of compliance finding this is -- action, not citation. */
const COMPLIANCE_KIND_MEANING: Record<string, string> = {
  violation: "Something on your website makes a claim regulators don't allow.",
  missing_disclosure: "Something patients expect to see on a healthcare website isn't visible yet.",
};

/** What each verdict means to the CLIENT — action, not jargon. */
const CLIENT_MEANING: Record<string, { label: string; detail: string }> = {
  consistent:   { label: 'Correct',      detail: 'Your name, address and phone all match here.' },
  drift:        { label: 'Needs tidying', detail: 'The same details, written differently. Search engines treat these as separate businesses, which weakens your local ranking.' },
  inconsistent: { label: 'Needs fixing',  detail: 'Something here does not match your details. Worth fixing first.' },
  not_found:    { label: 'Not listed',    detail: 'We could not find you here. A missing listing is a missing route to your door.' },
  ambiguous:    { label: 'Under review',  detail: 'We found a listing but could not be certain it is yours — often a duplicate or a similarly named business nearby. We are checking by hand rather than guessing.' },
  error:        { label: "Couldn't check", detail: 'This directory could not be read this time. It does not affect your score, and we will retry.' },
};

export default async function PortalListings() {
  const session = await getSession();
  const tenant = session?.tenants[0];
  if (!tenant) redirect('/portal');

  // Entitlement is a product gate, not a security one — RLS already restricts
  // the rows. This just avoids showing a module they did not buy.
  const entitlements = await getEntitlements(tenant.id);
  if (!isEntitled(entitlements, 'directory_nap')) redirect('/portal');

  const supabase = await createClient();

  const { data: audits } = await supabase
    .from('nap_audits')
    .select('id, location_id, status, audit_score, coverage_pct, directories_errored, completed_at, website_checked_for_compliance, compliance_score, is_compliant, tenant_locations ( name )')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(12);

  const latest = audits?.[0];

  if (!latest) {
    return (
      <>
        <PageHeader title="Your listings" description="How your details appear across directories." />
        <div className="p-8">
          <EmptyState
            title="No check has run yet"
            description="Once we have run the first check across Google, Justdial, Practo and the rest, your results will appear here — including anything that needs fixing."
          />
        </div>
      </>
    );
  }

  const [{ data: results }, { data: snapshots }, { data: complianceFindings }] = await Promise.all([
    supabase
      .from('nap_audit_results')
      .select('id, directory_code, status, listing_url, nap_field_diffs ( field_name, source_value, found_value, match_status, notes )')
      .eq('audit_id', latest.id)
      .order('directory_code'),
    supabase
      .from('metric_snapshots')
      .select('period_start, value')
      .eq('metric_code', 'nap_consistency_score')
      .eq('location_id', latest.location_id)
      .order('period_start', { ascending: true })
      .limit(24),
    latest.website_checked_for_compliance
      ? supabase
          .from('nap_compliance_findings')
          .select('kind, rule_label, remediation')
          .eq('audit_id', latest.id)
          .neq('kind', 'disclosure_present')
          .order('kind')
      : Promise.resolve({ data: null }),
  ]);

  const points = (snapshots ?? []).map((s) => ({ date: s.period_start as string, value: Number(s.value) }));
  const previous = points.length >= 2 ? points[points.length - 2]!.value : null;
  const location = latest.tenant_locations as unknown as { name: string } | null;

  // Everything the client can actually act on, worst first.
  const order = ['inconsistent', 'drift', 'not_found', 'ambiguous', 'error', 'consistent'];
  const sorted = [...(results ?? [])].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status),
  );
  const needsWork = sorted.filter((r) => r.status === 'inconsistent' || r.status === 'drift').length;

  return (
    <>
      <PageHeader
        title="Your listings"
        description={location ? `${location.name} — across Google, Justdial, Practo, Lybrate and Sulekha.` : undefined}
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <ScoreHero score={latest.audit_score} previous={previous} asOf={latest.completed_at} />

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="text-2xl font-semibold tabular-nums">{needsWork}</div>
            <div className="text-sm text-muted mt-1">Need attention</div>
          </div>
          <div className="card p-5">
            <div className="text-2xl font-semibold tabular-nums">{latest.coverage_pct ?? '—'}%</div>
            <div className="text-sm text-muted mt-1">Directories checked</div>
          </div>
          <div className="card p-5">
            <div className="text-2xl font-semibold tabular-nums">{latest.directories_errored}</div>
            <div className="text-sm text-muted mt-1">Could not be read</div>
          </div>
        </div>

        {latest.website_checked_for_compliance && (
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline flex items-center justify-between gap-4">
              <div>
                <h2 className="font-medium">Website compliance</h2>
                <p className="hint">Healthcare-advertising rules, checked on your homepage.</p>
              </div>
              <ComplianceScorePill score={latest.compliance_score} isCompliant={latest.is_compliant} />
            </div>
            {(complianceFindings ?? []).length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted">Nothing here needs attention.</p>
            ) : (
              <div className="divide-y divide-hairline">
                {(complianceFindings ?? []).map((f, i) => (
                  <div key={i} className="px-6 py-4">
                    <p className="text-sm">{COMPLIANCE_KIND_MEANING[f.kind] ?? f.rule_label}</p>
                    {f.remediation && <p className="hint mt-1">{f.remediation}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <ScoreSparkline points={points} />

        <section className="space-y-4">
          <h2 className="font-medium">Directory by directory</h2>
          {sorted.map((r) => {
            const meaning = CLIENT_MEANING[r.status];
            const diffs = (r.nap_field_diffs ?? []) as {
              field_name: string; source_value: string | null; found_value: string | null;
              match_status: string; notes: string | null;
            }[];
            // Only the fields that are actually wrong — a client does not need a
            // row telling them what already matches.
            const problems = diffs.filter((d) => d.match_status !== 'exact');

            return (
              <div key={r.id} className="card overflow-hidden">
                <div className="px-6 py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-medium capitalize">{r.directory_code.replace('_', ' ')}</h3>
                      <AuditStatusPill status={r.status} />
                    </div>
                    <p className="hint max-w-xl">{meaning?.detail}</p>
                  </div>
                  {r.listing_url && (
                    <a href={r.listing_url} target="_blank" rel="noopener noreferrer"
                       className="text-xs text-brand hover:underline shrink-0">
                      View ↗
                    </a>
                  )}
                </div>

                {problems.length > 0 && (
                  <div className="border-t border-hairline bg-brand-wash/40 px-6 py-4 space-y-3">
                    {problems.map((d) => (
                      <div key={d.field_name} className="text-sm">
                        <div className="font-medium capitalize">{d.field_name.replace('_', ' ')}</div>
                        <div className="grid sm:grid-cols-2 gap-1 mt-1 text-muted">
                          <div>Should be: <span className="text-ink">{d.source_value ?? '—'}</span></div>
                          <div>
                            Shows:{' '}
                            <span className="text-ink">
                              {d.found_value ?? <em className="text-muted">nothing</em>}
                            </span>
                          </div>
                        </div>
                        {d.notes && <p className="hint">{d.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
}
