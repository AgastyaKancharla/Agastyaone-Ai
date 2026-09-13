import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { AuditStatusPill } from '@/components/nap';
import { HeatmapTable, RankHeatmap, ScanMetrics, type HeatPoint } from '@/components/map-rank';
import { removeKeyword } from './actions';
import { AddKeywordForm, CoordinateForms, RunScanButton } from './map-rank-forms';

export default async function LocationMapRankPage({
  params,
}: {
  params: Promise<{ tenantId: string; locationId: string }>;
}) {
  const { tenantId, locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('id, name, city, tenant_id, latitude, longitude, geo_source, gbp_place_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!location || location.tenant_id !== tenantId) notFound();

  await supabase.rpc('log_tenant_access', {
    p_tenant_id: tenantId,
    p_reason: 'console_map_rank_detail',
  });

  const hasCentre = location.latitude !== null && location.longitude !== null;

  const [{ data: keywords }, { data: scans }] = await Promise.all([
    supabase
      .from('map_keywords')
      .select('id, phrase, is_active')
      .eq('location_id', locationId)
      .order('sort_order')
      .order('phrase'),
    supabase
      .from('map_scans')
      .select('id, keyword, status, grid_size, spacing_m, score, solv, arp, coverage_pct, points_scanned, points_requested, cost_micros, provider_code, created_at, completed_at, error_message')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // The most recent scan per keyword is what the heatmaps show; the rest is history.
  const latestByKeyword = new Map<string, NonNullable<typeof scans>[number]>();
  for (const scan of scans ?? []) {
    if (!latestByKeyword.has(scan.keyword) && (scan.status === 'completed' || scan.status === 'partial')) {
      latestByKeyword.set(scan.keyword, scan);
    }
  }

  const latestIds = [...latestByKeyword.values()].map((s) => s.id);
  const { data: points } = latestIds.length
    ? await supabase
        .from('map_scan_points')
        .select('scan_id, idx, row_n, col_n, status, rank')
        .in('scan_id', latestIds)
    : { data: null };

  const pointsByScan = new Map<string, HeatPoint[]>();
  for (const p of points ?? []) {
    const list = pointsByScan.get(p.scan_id) ?? [];
    list.push(p);
    pointsByScan.set(p.scan_id, list);
  }

  const { data: rivals } = latestIds.length
    ? await supabase
        .from('map_scan_competitor_rollup')
        .select('scan_id, name, points_seen, avg_rank, solv')
        .in('scan_id', latestIds)
        .order('points_seen', { ascending: false })
        .limit(40)
    : { data: null };

  return (
    <>
      <PageHeader
        title={`${location.name} — map rank`}
        description="Where this clinic appears on Google Maps across the area a patient would search from."
        action={<RunScanButton tenantId={tenantId} locationId={locationId} disabled={!hasCentre || (keywords ?? []).length === 0} />}
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Grid centre</h2>
              <p className="hint">
                Every scan is drawn around this point. A 9×9 grid at 800 m covers 6.4 km.
              </p>
            </div>
            {hasCentre && (
              <span className="pill bg-brand-wash text-brand-deep shrink-0">
                {location.geo_source === 'manual' ? 'set by hand' : 'from Google'}
              </span>
            )}
          </div>
          <div className="px-6 py-5">
            {!hasCentre && (
              <p className="text-sm text-danger mb-4">
                No coordinates yet, so a scan cannot run. Take them from the connected Google place, or
                enter them by hand.
              </p>
            )}
            <CoordinateForms
              tenantId={tenantId}
              locationId={locationId}
              latitude={location.latitude}
              longitude={location.longitude}
            />
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Tracked phrases</h2>
            <p className="hint">
              One scan per phrase per run. Track what a patient would actually type, not what the
              clinic calls itself.
            </p>
          </div>

          {(keywords ?? []).length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted">
              Nothing tracked yet. Add a phrase below to make scanning possible.
            </p>
          ) : (
            <div className="divide-y divide-hairline">
              {(keywords ?? []).map((k) => (
                <div key={k.id} className="px-6 py-3 flex items-center justify-between gap-4">
                  <span className="text-sm">{k.phrase}</span>
                  <form action={removeKeyword}>
                    <input type="hidden" name="tenant_id" value={tenantId} />
                    <input type="hidden" name="location_id" value={locationId} />
                    <input type="hidden" name="keyword_id" value={k.id} />
                    <button type="submit" className="text-xs text-muted hover:text-danger">
                      Remove
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          <div className="px-6 py-5 border-t border-hairline">
            <AddKeywordForm tenantId={tenantId} locationId={locationId} />
          </div>
        </section>

        {[...latestByKeyword.values()].map((scan) => {
          const scanPoints = pointsByScan.get(scan.id) ?? [];
          const scanRivals = (rivals ?? []).filter((r) => r.scan_id === scan.id).slice(0, 8);

          return (
            <section key={scan.id} className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-medium">&ldquo;{scan.keyword}&rdquo;</h2>
                  <p className="hint">
                    {scan.grid_size}×{scan.grid_size} at {scan.spacing_m} m via {scan.provider_code}
                    {scan.completed_at &&
                      ` · ${new Date(scan.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`}
                  </p>
                </div>
                <AuditStatusPill status={scan.status} />
              </div>

              <div className="px-6 py-5 space-y-6">
                <ScanMetrics
                  score={scan.score}
                  solv={scan.solv}
                  arp={scan.arp}
                  coverage={scan.coverage_pct}
                />

                {scan.coverage_pct !== null && scan.coverage_pct < 80 && (
                  <p className="text-sm text-accent-deep">
                    Only {scan.points_scanned} of {scan.points_requested} points came back, so this scan
                    is kept for reference but deliberately not charted — too little of the grid to say
                    anything honest about a trend.
                  </p>
                )}

                <RankHeatmap
                  points={scanPoints}
                  size={scan.grid_size}
                  spacingM={scan.spacing_m}
                  keyword={scan.keyword}
                />

                <HeatmapTable points={scanPoints} size={scan.grid_size} />

                {scanRivals.length > 0 && (
                  <div>
                    <h3 className="font-medium text-sm">Who is winning this grid</h3>
                    <p className="hint mb-2">
                      Staff only — the client&rsquo;s Portal shows their own ranking without naming rivals.
                    </p>
                    <table className="w-full">
                      <thead className="bg-brand-wash border-b border-hairline">
                        <tr>
                          <th className="th">Clinic</th>
                          <th className="th">Points seen</th>
                          <th className="th">Avg position</th>
                          <th className="th">Their SoLV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        {scanRivals.map((r) => (
                          <tr key={r.name} className="hover:bg-brand-wash/40 transition">
                            <td className="td">{r.name}</td>
                            <td className="td tabular-nums">{r.points_seen}</td>
                            <td className="td tabular-nums">{r.avg_rank ?? '—'}</td>
                            <td className="td tabular-nums">{r.solv !== null ? `${r.solv}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })}

        {(scans ?? []).length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">Scan history</h2>
            </div>
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Run</th>
                  <th className="th">Phrase</th>
                  <th className="th">Status</th>
                  <th className="th">Score</th>
                  <th className="th">Coverage</th>
                  <th className="th">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(scans ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td">
                      {new Date(s.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="td text-xs">{s.keyword}</td>
                    <td className="td"><AuditStatusPill status={s.status} /></td>
                    <td className="td tabular-nums">{s.score ?? '—'}</td>
                    <td className="td tabular-nums">
                      {s.coverage_pct !== null ? `${s.coverage_pct}%` : '—'}
                    </td>
                    <td className="td tabular-nums text-xs text-muted">
                      {s.cost_micros > 0 ? `$${(s.cost_micros / 1_000_000).toFixed(4)}` : 'free'}
                    </td>
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
