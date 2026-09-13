import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { placesClient } from '@agastyaone/places-client';
import { PageHeader, StatusPill } from '@/components/shell';
import { runExpressAudit, runDeepAudit, convertToClient } from '../actions';
import { ExpressAuditForm, DeepAuditForm } from './forms';

function tile(label: string, value: string, sub?: string) {
  return (
    <div className="card p-5">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted mt-1">{label}</div>
      {sub && <div className="hint mt-0.5">{sub}</div>}
    </div>
  );
}

export default async function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ note?: string }>;
}) {
  const { tenantId } = await params;
  const { note } = await searchParams;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, vertical, status, created_at')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) notFound();

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('id, city, address_line1, latitude, longitude, gbp_place_id')
    .eq('tenant_id', tenantId)
    .eq('is_primary', true)
    .maybeSingle();

  const locationId = location?.id ?? null;

  const [
    { data: napAudit },
    { data: visibilityAudit },
    { data: mapScan },
    { data: backlinksCheck },
    { data: geoRuns },
    { data: reviewSource },
  ] = locationId
    ? await Promise.all([
        supabase
          .from('nap_audits')
          .select('status, audit_score, coverage_pct, is_compliant, completed_at')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('visibility_audits')
          .select('status, composite_score, coverage_pct, completed_at')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('map_scans')
          .select('status, keyword, arp, solv, score, completed_at')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('backlinks_checks')
          .select('status, referring_domains, total_backlinks, score, completed_at')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('geo_runs')
          .select('status, was_mentioned')
          .eq('location_id', locationId)
          .eq('status', 'completed'),
        supabase
          .from('review_sources')
          .select('external_id')
          .eq('location_id', locationId)
          .eq('platform', 'google')
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }];

  const rating = reviewSource?.external_id
    ? await placesClient().getPlaceSummary(reviewSource.external_id)
    : null;

  const mentionedCount = (geoRuns ?? []).filter((r) => r.was_mentioned).length;
  const geoTotal = (geoRuns ?? []).length;

  return (
    <>
      <PageHeader
        title={tenant.name}
        description={`${location?.city ? `${location.city} · ` : ''}${tenant.vertical}`}
        action={
          <div className="flex items-center gap-2">
            <StatusPill status={tenant.status} />
            {tenant.status === 'prospect' && (
              <form action={convertToClient}>
                <input type="hidden" name="tenant_id" value={tenantId} />
                <button type="submit" className="btn-secondary">Convert to client</button>
              </form>
            )}
            <Link href="/console/prospects" className="btn-ghost">← All prospects</Link>
          </div>
        }
      />

      <div className="p-8 space-y-8 max-w-4xl">
        {note && (
          <p className="card p-4 text-sm text-accent-deep border-accent/30">{decodeURIComponent(note)}</p>
        )}

        {!locationId ? (
          <p className="card p-6 text-sm text-muted">No location on file — something went wrong creating this prospect.</p>
        ) : (
          <>
            <section className="card p-6 space-y-4">
              <h2 className="font-medium">Run an audit</h2>
              <div className="flex flex-wrap gap-3">
                <ExpressAuditForm tenantId={tenantId} action={runExpressAudit} />
                <DeepAuditForm tenantId={tenantId} action={runDeepAudit} />
              </div>
              <p className="hint">
                Express: GBP/NAP consistency + a light ranking check. Deep: every pillar, including AI-visibility and
                backlinks.
              </p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tile(
                'NAP / listings',
                napAudit ? (napAudit.audit_score !== null ? String(napAudit.audit_score) : napAudit.status) : 'not run',
                napAudit ? `${napAudit.coverage_pct ?? 0}% coverage${napAudit.is_compliant === false ? ' · compliance flagged' : ''}` : undefined,
              )}
              {tile(
                'Google rating',
                rating?.status === 'ok' && rating.summary.rating !== null ? `${rating.summary.rating}★` : '—',
                rating?.status === 'ok' ? `${rating.summary.userRatingCount ?? 0} reviews` : location?.gbp_place_id ? undefined : 'no place connected',
              )}
              {tile(
                'Map rank',
                mapScan ? (mapScan.arp !== null ? `#${mapScan.arp}` : mapScan.status) : 'not run',
                mapScan ? `"${mapScan.keyword}" · SoLV ${mapScan.solv ?? 0}%` : undefined,
              )}
              {tile(
                'Website',
                visibilityAudit ? (visibilityAudit.composite_score !== null ? String(visibilityAudit.composite_score) : visibilityAudit.status) : 'not run',
                visibilityAudit ? `${visibilityAudit.coverage_pct ?? 0}% coverage` : undefined,
              )}
              {tile(
                'AI visibility',
                geoTotal > 0 ? `${Math.round((100 * mentionedCount) / geoTotal)}%` : 'not run',
                geoTotal > 0 ? `mentioned in ${mentionedCount}/${geoTotal} checks` : undefined,
              )}
              {tile(
                'Backlinks',
                backlinksCheck ? (backlinksCheck.referring_domains !== null ? String(backlinksCheck.referring_domains) : backlinksCheck.status) : 'not run',
                backlinksCheck ? `referring domains · score ${backlinksCheck.score ?? 'n/a'}` : undefined,
              )}
            </div>

            <p className="text-sm text-muted space-x-4">
              <Link href={`/console/clients/${tenantId}/nap/${locationId}`} className="text-brand hover:underline">NAP detail →</Link>
              <Link href={`/console/clients/${tenantId}/reviews/${locationId}`} className="text-brand hover:underline">Reviews →</Link>
              <Link href={`/console/clients/${tenantId}/visibility/${locationId}`} className="text-brand hover:underline">Website detail →</Link>
              <Link href={`/console/clients/${tenantId}/map-rank/${locationId}`} className="text-brand hover:underline">Map rank heatmap →</Link>
              <Link href={`/console/clients/${tenantId}/ai-visibility/${locationId}`} className="text-brand hover:underline">AI visibility →</Link>
              <Link href={`/console/clients/${tenantId}/backlinks/${locationId}`} className="text-brand hover:underline">Backlinks →</Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
