import Link from 'next/link';
import { notFound } from 'next/navigation';
import { placesClient } from '@agastyaone/places-client';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { reviewQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site';
import { ConnectPlaceForm, IssueRequestForm, CopyLinkButton } from './review-forms';

const REQUEST_STATUS: Record<string, { label: string; tone: string }> = {
  pending:    { label: 'waiting to send', tone: 'bg-hairline text-muted' },
  sent:       { label: 'issued',          tone: 'bg-brand-wash text-brand-deep' },
  delivered:  { label: 'delivered',       tone: 'bg-brand-wash text-brand-deep' },
  clicked:    { label: 'scanned',         tone: 'bg-accent/10 text-accent-deep' },
  reviewed:   { label: 'reviewed',        tone: 'bg-accent/10 text-accent-deep' },
  failed:     { label: 'failed',          tone: 'bg-danger/10 text-danger' },
  suppressed: { label: 'suppressed',      tone: 'bg-hairline text-muted' },
};

export default async function LocationReviewsPage({
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
    p_reason: 'console_reviews',
  });

  const [{ data: source }, { data: requests }, { data: patients }] = await Promise.all([
    supabase
      .from('review_sources')
      .select('id, external_id, profile_url, is_active')
      .eq('location_id', locationId)
      .eq('platform', 'google')
      .maybeSingle(),
    supabase
      .from('review_requests')
      .select('id, status, channel, public_token, sent_at, clicked_at, created_at, contact_id')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('contacts')
      .select('id, full_name, primary_phone_e164')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  // Names for the request list. One pass over the patients we already loaded,
  // rather than a query per row.
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.full_name ?? '—']));

  const origin = await siteOrigin();

  // Live from Google. Never written to any table — the terms allow this to be
  // displayed with attribution, not warehoused.
  const places = source?.external_id
    ? await placesClient().getPlaceSummary(source.external_id)
    : ({ status: 'not_configured' } as const);

  return (
    <>
      <PageHeader
        title={`${location.name} — reviews`}
        description="What Google shows about this branch, and the codes handed to patients."
        action={
          <Link href={`/console/clients/${tenantId}`} className="btn-ghost">
            ← Back to client
          </Link>
        }
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <ConnectPlaceForm tenantId={tenantId} locationId={locationId} source={source ?? null} />

        {/* ---- Live rating ------------------------------------------------ */}
        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">On Google right now</h2>
            <p className="hint">
              Read live each time this page loads. Deliberately not stored, so there is no history
              here — the scan funnel below is the part we keep.
            </p>
          </div>

          <div className="px-6 py-5">
            {places.status === 'ok' ? (
              <div className="space-y-5">
                <div className="flex items-baseline gap-6">
                  <div>
                    <div className="text-4xl tabular-nums">
                      {places.summary.rating !== null ? places.summary.rating.toFixed(1) : '—'}
                      {places.summary.rating !== null && (
                        <span className="text-lg text-muted"> ★</span>
                      )}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {places.summary.userRatingCount !== null
                        ? `${places.summary.userRatingCount} reviews`
                        : 'no reviews yet'}
                    </div>
                  </div>
                  {places.summary.googleMapsUri && (
                    <a
                      href={places.summary.googleMapsUri}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs text-brand hover:underline"
                    >
                      View on Google →
                    </a>
                  )}
                </div>

                {places.summary.reviews.length > 0 && (
                  <ul className="space-y-4 border-t border-hairline pt-4">
                    {places.summary.reviews.map((r, i) => (
                      <li key={r.googleMapsUri ?? i} className="text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted">
                          {/* Google requires the reviewer's name to be shown
                              with their review. This is attribution, not chrome. */}
                          <span className="font-medium text-ink">{r.authorName ?? 'A patient'}</span>
                          {r.rating !== null && <span>{'★'.repeat(r.rating)}</span>}
                          {r.relativeTime && <span>· {r.relativeTime}</span>}
                        </div>
                        {r.text && <p className="mt-1 text-muted">{r.text}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <NotConnected status={places.status} hasPlaceId={Boolean(source?.external_id)} />
            )}
          </div>
        </section>

        {/* ---- Issue a code ----------------------------------------------- */}
        {source ? (
          <section className="card p-6 space-y-5">
            <div>
              <h2 className="font-medium">Ask for a review</h2>
              <p className="hint">
                Show the code at the desk as the patient leaves. No opt-in is needed because nobody
                is being messaged — WhatsApp and SMS are a different matter, and are refused until a
                real opt-in is recorded.
              </p>
            </div>
            <IssueRequestForm
              tenantId={tenantId}
              locationId={locationId}
              sourceId={source.id}
              patients={(patients ?? []).map((p) => ({
                id: p.id,
                label: `${p.full_name ?? 'Unnamed'}${p.primary_phone_e164 ? ` · ${p.primary_phone_e164}` : ''}`,
              }))}
            />
          </section>
        ) : null}

        {/* ---- Issued codes ------------------------------------------------ */}
        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Codes issued</h2>
            <p className="hint">
              We record that a code was handed over and that it was scanned. Google does not say who
              posted a review, so nothing here claims to know.
            </p>
          </div>

          {!requests || requests.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No codes yet"
                description={
                  source
                    ? 'Create one above and it will appear here, ready to show or print.'
                    : 'Connect the Google listing first, then codes can be issued.'
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {requests.map((r) => {
                const url = r.public_token ? `${origin}/r/${r.public_token}` : null;
                const status = REQUEST_STATUS[r.status] ?? { label: r.status, tone: 'bg-hairline text-muted' };

                return (
                  <li key={r.id} className="px-6 py-4 flex items-center gap-5">
                    {url ? (
                      <div
                        className="shrink-0 rounded border border-hairline bg-white p-1"
                        dangerouslySetInnerHTML={{ __html: reviewQrSvg(url, 72) }}
                      />
                    ) : (
                      <div className="shrink-0 w-[72px] h-[72px] rounded border border-dashed border-hairline" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {nameById.get(r.contact_id) ?? 'Patient'}
                        </span>
                        <span className={`pill ${status.tone}`}>{status.label}</span>
                        {r.channel !== 'link' && (
                          <span className="pill bg-hairline text-muted">{r.channel}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {r.sent_at
                          ? `Issued ${new Date(r.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                          : 'Not sent yet'}
                        {r.clicked_at &&
                          ` · scanned ${new Date(r.clicked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                      </div>
                      {url && (
                        <div className="mt-1">
                          <CopyLinkButton url={url} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

/**
 * Every non-ok state renders as an explanation, never as a rating. A quota error
 * showing "0.0 ★" is the mistake the retired NAP tool made with errored
 * directories, and it is worse here because a client would see it.
 */
function NotConnected({ status, hasPlaceId }: { status: string; hasPlaceId: boolean }) {
  const message =
    status === 'not_found'
      ? hasPlaceId
        ? 'Google does not recognise that place ID. Check it against the clinic’s Business Profile.'
        : 'No listing connected yet.'
      : status === 'unavailable'
        ? 'Google could not be reached just now. This says nothing about the clinic’s rating — try again shortly.'
        : hasPlaceId
          ? 'A Places API key has not been configured yet, so the live rating cannot be read.'
          : 'Connect the Google listing above to see the live rating and recent reviews.';

  return <p className="text-sm text-muted">{message}</p>;
}
