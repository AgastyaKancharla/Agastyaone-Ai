# @agastyaone/places-client

A small, typed wrapper over Google **Places API (New)** — Place Details.

It exists so a clinic's Google rating and recent reviews can be shown in the
Console and Portal **today**, without waiting on Business Profile API access
(which needs a verified profile 60+ days old, owned by us, and an approved
application).

Places needs none of that: a Cloud project with billing enabled and Places API
(New) switched on. It answers for any business, whether or not we manage it.

## The rule that must not be broken later

**Ratings and review text may be displayed live, with attribution. They must not
be stored.**

Maps Platform terms allow a *place ID* to be cached indefinitely — which is why
`review_sources.external_id` holds one — but the content fetched against it
must be requested fresh and shown with a link back to Google.

So:

- Nothing in this package writes to a database, and nothing should be added that
  does.
- `metric_snapshots` deliberately has **no rating metric**. A snapshot row is
  storage by definition; it exists so a value can be read back months later.
- The `reviews` table stays empty while this is the only source. It is the
  destination for owner-authorised **GBP API** data later, which carries no such
  restriction, and the review-runtime suite asserts nothing lands there before
  then.

The practical consequence, stated plainly because a client will ask: there is a
live rating with **no history**, and a request funnel **with** history. That
split is honest about which numbers are ours to keep.

## Why the result is a union

```ts
type PlacesResult =
  | { status: 'ok'; summary: PlaceSummary }
  | { status: 'not_configured' }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: string };
```

The retired NAP tool averaged failed directory checks in as zero and dropped a
perfect client to 60%. The same mistake here would show a clinic **0.0 ★**
because a quota was exceeded. A caller cannot reach `rating` without narrowing
on `status === 'ok'` first, so the compiler refuses to let a failure be rendered
as a bad score.

`not_configured` is a state, not an error: before a key exists the UI says "not
connected yet", and no request is spent finding that out.

## Billing

Place Details is billed **per field**, so the field mask is an explicit constant
rather than a wildcard — a wildcard would silently start billing for every field
Google adds in future.

Two guards, both tested:

- **In-process cache**, 10 minutes by default. A Console page left open on a
  refresh loop otherwise bills a request per render. Failures are *not* cached,
  since that would turn a brief blip into a full TTL of downtime.
- **In-flight de-duplication.** Concurrent lookups of the same place collapse
  into one request, which is what actually saves you during a refresh storm.

The cache is a rate guard, not a store: it lives in process memory and dies with
the process.

## Configuration

```
GOOGLE_PLACES_API_KEY=...
```

Deliberately **not** `NEXT_PUBLIC_*` — a browser-readable Maps key is a key
anyone can spend. Every call site must be server-side. The key travels in the
`X-Goog-Api-Key` header, never a query string (query strings land in proxy and
access logs), and is redacted from any error this package returns.

Restrict the key to the Places API in the Cloud console.

## Testing

```
npm test --workspace @agastyaone/places-client
```

12 assertions, no network: `fetch` and the clock are injected, so quota
exhaustion, cache expiry and key redaction are all exercised deterministically.
