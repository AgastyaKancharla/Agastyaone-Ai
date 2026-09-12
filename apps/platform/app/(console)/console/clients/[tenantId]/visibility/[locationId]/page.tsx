import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { AuditStatusPill } from '@/components/nap';
import {
  FindingKindPill,
  PillarBars,
  SIGNAL_GROUP_LABEL,
  VisibilityScoreHero,
} from '@/components/visibility';
import { RunVisibilityAuditButton } from './visibility-forms';

export default async function LocationVisibilityPage({
  params,
}: {
  params: Promise<{ tenantId: string; locationId: string }>;
}) {
  const { tenantId, locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('id, name, city, tenant_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!location || location.tenant_id !== tenantId) notFound();

  await supabase.rpc('log_tenant_access', {
    p_tenant_id: tenantId,
    p_reason: 'console_visibility_detail',
  });

  const { data: audits } = await supabase
    .from('visibility_audits')
    .select('id, status, composite_score, coverage_pct, website_url, created_at, completed_at, error_message')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(10);

  const latest = audits?.[0];

  const [{ data: pillars }, { data: findings }] = latest
    ? await Promise.all([
        supabase
          .from('visibility_pillar_scores')
          .select('pillar, score, weight, measured, detail')
          .eq('audit_id', latest.id),
        supabase
          .from('visibility_website_findings')
          .select('kind, signal_group, rule_label, severity, snippet, remediation')
          .eq('audit_id', latest.id),
      ])
    : [{ data: null }, { data: null }];

  // Model order, not database order — the client should always read the
  // pillars in the same sequence regardless of what a query happened to return.
  const ORDER = ['map_rank', 'website', 'citations', 'reviews', 'ai_visibility', 'backlinks'];
  const orderedPillars = (pillars ?? []).slice().sort(
    (a, b) => ORDER.indexOf(a.pillar) - ORDER.indexOf(b.pillar),
  );
  const measuredCount = orderedPillars.filter((p) => p.measured).length;

  const actionable = (findings ?? []).filter((f) => f.kind !== 'passed');
  const passed = (findings ?? []).filter((f) => f.kind === 'passed');

  return (
    <>
      <PageHeader
        title={`${location.name} — visibility`}
        description="One score across map rank, website, listings, reviews, AI answer engines and backlinks."
        action={<RunVisibilityAuditButton tenantId={tenantId} locationId={locationId} />}
      />

      <div className="p-8 space-y-8 max-w-4xl">
        {!latest ? (
          <div className="card p-12 text-center">
            <h3 className="font-medium">No visibility audit yet</h3>
            <p className="hint max-w-md mx-auto mt-2">
              Run one to score this location. The website pillar needs a site on file — from the NAP
              source of truth, or a site we built and have marked live.
            </p>
          </div>
        ) : (
          <>
            <VisibilityScoreHero
              score={latest.composite_score}
              coverage={latest.coverage_pct}
              measured={measuredCount}
              asOf={latest.completed_at}
            />

            <section className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline">
                <h2 className="font-medium">Pillars</h2>
                <p className="hint">
                  Each pillar&rsquo;s own score and what it was worth on this run. Weights are recorded
                  per audit, so re-tuning the model later never rewrites what an old score meant.
                </p>
              </div>
              <PillarBars pillars={orderedPillars} />
            </section>

            <section className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-medium">Website findings</h2>
                  <p className="hint">
                    {latest.website_url
                      ? `Checked ${latest.website_url}`
                      : 'No website was on file for this location.'}
                  </p>
                </div>
                {actionable.length > 0 && (
                  <span className="pill bg-accent/10 text-accent-deep shrink-0">
                    {actionable.length} to act on
                  </span>
                )}
              </div>

              {(findings ?? []).length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted">
                  {latest.website_url
                    ? 'The site could not be read on this run. Nothing here counts against the score — the pillar is simply unmeasured.'
                    : 'Set a website on the NAP source of truth, then run this again.'}
                </p>
              ) : (
                <div className="divide-y divide-hairline">
                  {actionable.map((f, i) => (
                    <div key={i} className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <FindingKindPill kind={f.kind} />
                        <span className="pill bg-hairline text-muted">
                          {SIGNAL_GROUP_LABEL[f.signal_group] ?? f.signal_group}
                        </span>
                        {f.severity && <span className="text-xs text-muted">{f.severity}</span>}
                        <span className="text-sm font-medium">{f.rule_label}</span>
                      </div>
                      {f.snippet && <p className="hint mt-1">Found: &ldquo;{f.snippet}&rdquo;</p>}
                      {f.remediation && <p className="hint">{f.remediation}</p>}
                    </div>
                  ))}

                  {passed.length > 0 && (
                    <details className="px-6 py-4">
                      <summary className="text-sm text-muted cursor-pointer">
                        {passed.length} checks passed
                      </summary>
                      <ul className="mt-3 space-y-1.5">
                        {passed.map((f, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-brand shrink-0">✓</span>
                            <span>
                              {f.rule_label}
                              {f.snippet && <span className="text-muted"> — {f.snippet}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </section>

            <section className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline">
                <h2 className="font-medium">Audit history</h2>
              </div>
              <table className="w-full">
                <thead className="bg-brand-wash border-b border-hairline">
                  <tr>
                    <th className="th">Run</th>
                    <th className="th">Status</th>
                    <th className="th">Score</th>
                    <th className="th">Coverage</th>
                    <th className="th">Site</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {(audits ?? []).map((a) => (
                    <tr key={a.id} className="hover:bg-brand-wash/40 transition">
                      <td className="td">
                        {new Date(a.created_at).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="td"><AuditStatusPill status={a.status} /></td>
                      <td className="td tabular-nums">{a.composite_score ?? '—'}</td>
                      <td className="td tabular-nums">
                        {a.coverage_pct !== null ? `${a.coverage_pct}%` : '—'}
                      </td>
                      <td className="td text-xs text-muted truncate max-w-[16rem]">
                        {a.error_message ?? a.website_url ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}

        <p className="text-sm text-muted">
          <Link href={`/console/clients/${tenantId}`} className="text-brand hover:underline">
            ← Back to client
          </Link>
        </p>
      </div>
    </>
  );
}
