import { redirect } from 'next/navigation';
import { placesClient } from '@agastyaone/places-client';
import { getSession } from '@/lib/session';
import { getEntitlements, isEntitled } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { ScoreSparkline } from '@/components/nap';

export default async function PortalReviews() {
  const session = await getSession();
  const tenant = session?.tenants[0];
  if (!tenant) redirect('/portal');

  // Entitlement is a product gate, not a security one — RLS already restricts
  // the rows. This just avoids showing a module they did not buy.
  const entitlements = await getEntitlements(tenant.id);
  if (!isEntitled(entitlements, 'review_automation')) redirect('/portal');

  const supabase = await createClient();

  const { data: source } = await supabase
    .from('review_sources')
    .select('id, external_id, profile_url, location_id')
    .eq('tenant_id', tenant.id)
    .eq('platform', 'google')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  // Nothing connected yet: say so and stop, before paying for the queries below.
  if (!source) {
    return (
      <>
        <PageHeader title="Your reviews" description="What patients say about you on Google." />
        <div className="p-8">
          <EmptyState
            title="Not connected yet"
            description="Once we have linked your Google listing, your rating and recent reviews will appear here — along with how many patients we asked."
          />
        </div>
      </>
    );
  }

  const [places, { data: snapshots }, { data: recent }] = await Promise.all([
    source.external_id
      ? placesClient().getPlaceSummary(source.external_id)
      : Promise.resolve({ status: 'not_configured' } as const),
    supabase
      .from('metric_snapshots')
      .select('metric_code, value, period_start')
      .eq('tenant_id', tenant.id)
      .in('metric_code', ['review_requests_issued', 'review_requests_clicked'])
      .order('period_start', { ascending: true })
      .limit(120),
    supabase
      .from('review_requests')
      .select('status, sent_at, clicked_at')
      .eq('tenant_id', tenant.id)
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(500),
  ]);

  const issuedPoints = (snapshots ?? [])
    .filter((s) => s.metric_code === 'review_requests_issued')
    .map((s) => ({ date: s.period_start, value: Number(s.value) }));

  const totalIssued = (recent ?? []).length;
  const totalScanned = (recent ?? []).filter((r) => r.clicked_at !== null).length;

  return (
    <>
      <PageHeader
        title="Your reviews"
        description="What patients say about you on Google, and how many we asked."
      />

      <div className="p-8 space-y-8 max-w-3xl">
        {/* ---- The rating, live ------------------------------------------- */}
        <section className="card p-6">
          {places.status === 'ok' ? (
            <>
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-5xl tabular-nums leading-none">
                    {places.summary.rating !== null ? places.summary.rating.toFixed(1) : '—'}
                  </div>
                  <div className="text-sm text-muted mt-2">
                    {places.summary.rating !== null ? 'out of 5 on Google' : 'no rating yet'}
                  </div>
                </div>
                <div className="pb-1">
                  <div className="text-2xl tabular-nums">
                    {places.summary.userRatingCount ?? '—'}
                  </div>
                  <div className="text-sm text-muted">reviews</div>
                </div>
              </div>

              <p className="hint mt-4">
                Read from Google as this page loaded, so it is always current — which also means
                there is no history of it here.
                {places.summary.googleMapsUri && (
                  <>
                    {' '}
                    <a
                      href={places.summary.googleMapsUri}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand hover:underline"
                    >
                      See it on Google
                    </a>
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              {places.status === 'unavailable'
                ? 'We could not read your rating from Google just now. It will be back shortly — this does not reflect anything about your listing.'
                : 'Your Google listing is being connected. Your rating will appear here once it is.'}
            </p>
          )}
        </section>

        {/* ---- What patients wrote ---------------------------------------- */}
        {places.status === 'ok' && places.summary.reviews.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">Recent reviews</h2>
            </div>
            <ul className="divide-y divide-hairline">
              {places.summary.reviews.map((r, i) => (
                <li key={r.googleMapsUri ?? i} className="px-6 py-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-medium text-ink">{r.authorName ?? 'A patient'}</span>
                    {r.rating !== null && <span className="text-accent-deep">{'★'.repeat(r.rating)}</span>}
                    {r.relativeTime && <span>· {r.relativeTime}</span>}
                  </div>
                  {r.text && <p className="text-sm mt-1.5">{r.text}</p>}
                </li>
              ))}
            </ul>
            <p className="px-6 py-3 text-[11px] text-muted border-t border-hairline">
              Reviews and ratings are shown as published on Google.
            </p>
          </section>
        )}

        {/* ---- The part we actually control -------------------------------- */}
        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Review requests</h2>
            <p className="hint">
              Codes handed to patients at your front desk, and how many were scanned.
            </p>
          </div>

          {totalIssued === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No requests yet"
                description="Once your team starts handing patients a review code as they leave, the numbers will build up here."
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-hairline">
                <Tile label="Codes given" value={totalIssued} />
                <Tile label="Scanned" value={totalScanned} />
                <Tile
                  label="Scan rate"
                  value={totalIssued > 0 ? `${Math.round((totalScanned / totalIssued) * 100)}%` : '—'}
                />
              </div>

              {/* Same discipline as the listings trend: a line through one or
                  two points is a trend that does not exist. */}
              {issuedPoints.length >= 3 && (
                <div className="px-6 py-5 border-t border-hairline">
                  <div className="text-xs text-muted mb-2">Codes given per day</div>
                  <ScoreSparkline points={issuedPoints} />
                </div>
              )}

              <p className="px-6 py-3 text-[11px] text-muted border-t border-hairline">
                A scan is not the same as a review. Google does not tell anyone who wrote a review,
                so we count what we can actually see.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-6 py-5 text-center">
      <div className="text-2xl tabular-nums">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}
