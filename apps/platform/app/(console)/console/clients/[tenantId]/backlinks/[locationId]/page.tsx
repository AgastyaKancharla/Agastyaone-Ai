import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { AuditStatusPill } from '@/components/nap';
import { BacklinksSummaryTiles } from '@/components/backlinks';
import { RunCheckButton } from './backlinks-forms';

export default async function LocationBacklinksPage({
  params,
}: {
  params: Promise<{ tenantId: string; locationId: string }>;
}) {
  const { tenantId, locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('id, name, tenant_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!location || location.tenant_id !== tenantId) notFound();

  await supabase.rpc('log_tenant_access', {
    p_tenant_id: tenantId,
    p_reason: 'console_backlinks_detail',
  });

  const { data: checks } = await supabase
    .from('backlinks_checks')
    .select('id, domain, status, referring_domains, total_backlinks, broken_backlinks, spam_score, domain_rank, score, provider_code, created_at, completed_at, error_message')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(20);

  const latest = (checks ?? []).find((c) => c.status === 'completed');

  return (
    <>
      <PageHeader
        title={`${location.name} — backlinks`}
        description="Who is linking to this clinic's website, and whether that link profile looks healthy."
        action={<RunCheckButton tenantId={tenantId} locationId={locationId} />}
      />

      <div className="p-8 space-y-8 max-w-4xl">
        {latest ? (
          <section className="space-y-2">
            <p className="hint">
              &ldquo;{latest.domain}&rdquo; · checked{' '}
              {latest.completed_at &&
                new Date(latest.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}{' '}
              via {latest.provider_code}
              {latest.domain_rank !== null && ` · provider rank ${latest.domain_rank}`}
            </p>
            <BacklinksSummaryTiles
              score={latest.score}
              referringDomains={latest.referring_domains}
              totalBacklinks={latest.total_backlinks}
              brokenBacklinks={latest.broken_backlinks}
              spamScore={latest.spam_score}
            />
          </section>
        ) : (
          <p className="text-sm text-muted">
            No completed check yet. Run one above — it needs a website on file for this location.
          </p>
        )}

        {(checks ?? []).length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">Check history</h2>
            </div>
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Run</th>
                  <th className="th">Domain</th>
                  <th className="th">Status</th>
                  <th className="th">Score</th>
                  <th className="th">Referring domains</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(checks ?? []).map((c) => (
                  <tr key={c.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td">
                      {new Date(c.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="td text-xs">{c.domain}</td>
                    <td className="td">
                      <AuditStatusPill status={c.status} />
                      {c.status === 'failed' && c.error_message && (
                        <span className="text-xs text-muted ml-2">{c.error_message}</span>
                      )}
                    </td>
                    <td className="td tabular-nums">{c.score ?? '—'}</td>
                    <td className="td tabular-nums">{c.referring_domains ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
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
