import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlacesClient } from '../src/client.ts';
import type { PlacesResult } from '../src/types.ts';

/**
 * No network. `fetch` and the clock are injected, so every branch — including
 * quota exhaustion and cache expiry — is exercised deterministically rather
 * than hoped for.
 */

const PLACE = 'ChIJexample_bengaluru_clinic';

const okBody = {
  id: PLACE,
  displayName: { text: 'Smile Dental Care' },
  rating: 4.6,
  userRatingCount: 218,
  googleMapsUri: 'https://maps.google.com/?cid=123',
  reviews: [
    {
      rating: 5,
      text: { text: 'Painless root canal, genuinely.' },
      originalText: { text: 'Painless root canal, genuinely.' },
      relativePublishTimeDescription: '2 months ago',
      publishTime: '2026-07-02T10:00:00Z',
      googleMapsUri: 'https://maps.google.com/review/1',
      authorAttribution: {
        displayName: 'Kruthika R',
        photoUri: 'https://lh3.googleusercontent.com/a/x',
        uri: 'https://maps.google.com/contrib/1',
      },
    },
  ],
};

function stubFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response> | Response,
): { fetch: typeof fetch; calls: string[]; headers: Record<string, string>[] } {
  const calls: string[] = [];
  const headers: Record<string, string>[] = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push(String(url));
    if (init?.headers) headers.push(init.headers as Record<string, string>);
    return impl(String(url), init);
  }) as unknown as typeof fetch;
  return { fetch: fn, calls, headers };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function expectOk(result: PlacesResult) {
  assert.equal(result.status, 'ok');
  if (result.status !== 'ok') throw new Error('unreachable');
  return result.summary;
}

// ---------------------------------------------------------------------------
// Not configured is a STATE, not an error. A clinic that has not been connected
// yet must render as "not connected", never as a zero rating or a crash.
// ---------------------------------------------------------------------------
test('with no API key it reports not_configured without calling out', async () => {
  const stub = stubFetch(() => json(okBody));
  const client = new PlacesClient({ fetchImpl: stub.fetch });

  assert.equal(client.configured, false);
  const result = await client.getPlaceSummary(PLACE);
  assert.equal(result.status, 'not_configured');
  assert.equal(stub.calls.length, 0, 'must not spend a request when unconfigured');
});

test('a successful lookup maps the fields the UI needs', async () => {
  const stub = stubFetch(() => json(okBody));
  const client = new PlacesClient({ apiKey: 'k', fetchImpl: stub.fetch, now: () => 0 });

  const summary = expectOk(await client.getPlaceSummary(PLACE));
  assert.equal(summary.rating, 4.6);
  assert.equal(summary.userRatingCount, 218);
  assert.equal(summary.name, 'Smile Dental Care');
  assert.equal(summary.googleMapsUri, 'https://maps.google.com/?cid=123');
  assert.equal(summary.reviews.length, 1);

  const review = summary.reviews[0]!;
  assert.equal(review.authorName, 'Kruthika R');
  assert.equal(review.rating, 5);
  assert.equal(review.relativeTime, '2 months ago');
  // Attribution is not decoration: the terms require the author and a link back.
  assert.ok(review.authorPhotoUri);
  assert.ok(review.googleMapsUri);
});

test('the request is billed only for the fields we ask for, and the key never hits the URL', async () => {
  const stub = stubFetch(() => json(okBody));
  const client = new PlacesClient({ apiKey: 'secret-key', fetchImpl: stub.fetch });
  await client.getPlaceSummary(PLACE);

  const headers = stub.headers[0]!;
  assert.equal(headers['X-Goog-Api-Key'], 'secret-key');
  assert.ok(headers['X-Goog-FieldMask']?.includes('rating'));
  assert.ok(headers['X-Goog-FieldMask']?.includes('reviews'));
  // A wildcard mask would silently bill for every field Google adds later.
  assert.ok(!headers['X-Goog-FieldMask']?.includes('*'));
  assert.ok(!stub.calls[0]?.includes('secret-key'), 'key must not appear in the URL');
});

// ---------------------------------------------------------------------------
// Failure modes. The whole reason for the discriminated union: none of these
// may be reachable as a rating.
// ---------------------------------------------------------------------------
test('an unknown place id is not_found, not an outage', async () => {
  const client = new PlacesClient({
    apiKey: 'k',
    fetchImpl: stubFetch(() => json({ error: 'not found' }, 404)).fetch,
  });
  assert.equal((await client.getPlaceSummary('ChIJnope')).status, 'not_found');
});

test('a malformed place id reads as not_found rather than "try again later"', async () => {
  const client = new PlacesClient({
    apiKey: 'k',
    fetchImpl: stubFetch(() => json({ error: 'bad request' }, 400)).fetch,
  });
  // 400 means the id is wrong. Reporting it as transient sends the operator
  // looking for an outage instead of fixing the id they pasted.
  assert.equal((await client.getPlaceSummary('!!')).status, 'not_found');
});

test('quota exhaustion is unavailable and carries no rating at all', async () => {
  const client = new PlacesClient({
    apiKey: 'k',
    fetchImpl: stubFetch(() => json({ error: 'RESOURCE_EXHAUSTED' }, 429)).fetch,
  });
  const result = await client.getPlaceSummary(PLACE);
  assert.equal(result.status, 'unavailable');
  assert.ok(!('summary' in result));
});

test('a network failure is unavailable and never leaks the key', async () => {
  const client = new PlacesClient({
    apiKey: 'super-secret',
    fetchImpl: stubFetch(() => {
      throw new Error('connect ECONNREFUSED using key super-secret');
    }).fetch,
  });
  const result = await client.getPlaceSummary(PLACE);
  assert.equal(result.status, 'unavailable');
  if (result.status !== 'unavailable') throw new Error('unreachable');
  assert.ok(!result.reason.includes('super-secret'), 'the key must be redacted from errors');
  assert.ok(result.reason.includes('[redacted]'));
});

test('a place with no reviews yet is a valid result, not an empty one', async () => {
  const client = new PlacesClient({
    apiKey: 'k',
    fetchImpl: stubFetch(() => json({ id: PLACE, displayName: { text: 'New Clinic' } })).fetch,
  });
  const summary = expectOk(await client.getPlaceSummary(PLACE));
  // A brand-new listing genuinely has no rating. Null, so the UI shows "—"
  // rather than implying the clinic scored zero.
  assert.equal(summary.rating, null);
  assert.equal(summary.userRatingCount, null);
  assert.deepEqual(summary.reviews, []);
});

// ---------------------------------------------------------------------------
// Billing guards.
// ---------------------------------------------------------------------------
test('repeat lookups are served from cache until the TTL expires', async () => {
  let clock = 0;
  const stub = stubFetch(() => json(okBody));
  const client = new PlacesClient({
    apiKey: 'k',
    fetchImpl: stub.fetch,
    ttlMs: 1000,
    now: () => clock,
  });

  await client.getPlaceSummary(PLACE);
  await client.getPlaceSummary(PLACE);
  assert.equal(stub.calls.length, 1, 'a page refresh must not bill a second request');

  clock = 1001;
  await client.getPlaceSummary(PLACE);
  assert.equal(stub.calls.length, 2, 'and it must refresh once the TTL passes');
});

test('concurrent lookups of the same place collapse into one request', async () => {
  const stub = stubFetch(
    () => new Promise<Response>((resolve) => setTimeout(() => resolve(json(okBody)), 5)),
  );
  const client = new PlacesClient({ apiKey: 'k', fetchImpl: stub.fetch });

  const results = await Promise.all([
    client.getPlaceSummary(PLACE),
    client.getPlaceSummary(PLACE),
    client.getPlaceSummary(PLACE),
  ]);

  assert.equal(stub.calls.length, 1, 'three concurrent renders, one billed request');
  for (const r of results) assert.equal(r.status, 'ok');
});

test('a transient failure is NOT cached', async () => {
  let fail = true;
  const stub = stubFetch(() => (fail ? json({}, 503) : json(okBody)));
  const client = new PlacesClient({ apiKey: 'k', fetchImpl: stub.fetch, ttlMs: 60_000 });

  assert.equal((await client.getPlaceSummary(PLACE)).status, 'unavailable');
  fail = false;
  // Caching the failure would turn a brief blip into a full TTL of downtime.
  assert.equal((await client.getPlaceSummary(PLACE)).status, 'ok');
  assert.equal(stub.calls.length, 2);
});

test('different places do not share a cache entry', async () => {
  const stub = stubFetch((url) =>
    json(url.includes('AAA') ? { ...okBody, id: 'AAA', rating: 4.6 } : { ...okBody, id: 'BBB', rating: 3.1 }),
  );
  const client = new PlacesClient({ apiKey: 'k', fetchImpl: stub.fetch });

  assert.equal(expectOk(await client.getPlaceSummary('AAA')).rating, 4.6);
  assert.equal(expectOk(await client.getPlaceSummary('BBB')).rating, 3.1);
  assert.equal(stub.calls.length, 2);
});
