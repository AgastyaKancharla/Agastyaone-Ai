import type {
  PlaceReview,
  PlaceSummary,
  PlacesClientOptions,
  PlacesResult,
} from './types.ts';

/**
 * Google Places (New) — Place Details, narrowed to what the review service shows.
 *
 * Two things this package exists to get right:
 *
 * 1. BILLING. Place Details is billed by the field mask, so the mask is explicit
 *    and minimal, and identical results are cached in-process for a few minutes.
 *    Without that, a Console page left open on a refresh loop bills a request
 *    per render. Concurrent calls for the same place are also collapsed into one
 *    in-flight request, which is what actually saves you during a refresh storm.
 *
 * 2. TERMS. Ratings, review text, author names and photos may be displayed live
 *    with attribution but not warehoused. So this returns data and never stores
 *    it: the cache is a rate guard that lives in process memory and dies with
 *    the process. Nothing here writes to a database, and nothing should.
 */

/**
 * Billed per field. `reviews` is the expensive one and the reason this is a
 * deliberate constant rather than a wildcard.
 */
const FIELD_MASK = [
  'id',
  'displayName',
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'reviews',
].join(',');

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_BASE_URL = 'https://places.googleapis.com/v1/places';

type CacheEntry = { expiresAt: number; result: PlacesResult };

/** Shape of the subset of the Places response we read. */
type RawReview = {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
  googleMapsUri?: string;
  authorAttribution?: { displayName?: string; photoUri?: string; uri?: string };
};

type RawPlace = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: RawReview[];
};

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v : null;

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function toReview(raw: RawReview): PlaceReview {
  return {
    authorName: str(raw.authorAttribution?.displayName),
    authorPhotoUri: str(raw.authorAttribution?.photoUri),
    authorUri: str(raw.authorAttribution?.uri),
    rating: num(raw.rating),
    // `text` is Google's translated rendering; originalText is what was written.
    // Prefer the translation the API chose for the request locale, falling back
    // to the original rather than showing nothing.
    text: str(raw.text?.text) ?? str(raw.originalText?.text),
    relativeTime: str(raw.relativePublishTimeDescription),
    publishedAt: str(raw.publishTime),
    googleMapsUri: str(raw.googleMapsUri),
  };
}

export class PlacesClient {
  readonly #apiKey: string | undefined;
  readonly #fetch: typeof fetch;
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #baseUrl: string;
  readonly #cache = new Map<string, CacheEntry>();
  readonly #inFlight = new Map<string, Promise<PlacesResult>>();

  constructor(options: PlacesClientOptions = {}) {
    this.#apiKey = options.apiKey;
    this.#fetch = options.fetchImpl ?? globalThis.fetch;
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.#now = options.now ?? Date.now;
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  }

  /** True when a key is configured. Lets the UI say "not connected" without a call. */
  get configured(): boolean {
    return typeof this.#apiKey === 'string' && this.#apiKey.trim() !== '';
  }

  async getPlaceSummary(placeId: string): Promise<PlacesResult> {
    if (!this.configured) return { status: 'not_configured' };
    if (typeof placeId !== 'string' || placeId.trim() === '') {
      return { status: 'not_found' };
    }

    const key = placeId.trim();

    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > this.#now()) return cached.result;

    // Collapse concurrent calls for the same place. Ten components rendering the
    // same clinic must not become ten billed requests.
    const existing = this.#inFlight.get(key);
    if (existing) return existing;

    const pending = this.#fetchPlace(key)
      .then((result) => {
        // Only cache settled truths. Caching a quota error would extend a
        // five-minute outage into a fifteen-minute one.
        if (result.status === 'ok' || result.status === 'not_found') {
          this.#cache.set(key, { expiresAt: this.#now() + this.#ttlMs, result });
        }
        return result;
      })
      .finally(() => {
        this.#inFlight.delete(key);
      });

    this.#inFlight.set(key, pending);
    return pending;
  }

  async #fetchPlace(placeId: string): Promise<PlacesResult> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/${encodeURIComponent(placeId)}`, {
        method: 'GET',
        headers: {
          // The key travels in a header, never a query string: query strings end
          // up in proxy and access logs.
          'X-Goog-Api-Key': this.#apiKey as string,
          'X-Goog-FieldMask': FIELD_MASK,
        },
      });
    } catch (err) {
      // Never let the error text carry the key, whatever the transport put in it.
      return { status: 'unavailable', reason: this.#redact(err) };
    }

    if (response.status === 404) return { status: 'not_found' };

    if (!response.ok) {
      // 400 here almost always means a malformed place ID rather than an outage,
      // and telling the operator "couldn't check, try later" would send them
      // looking in the wrong place.
      if (response.status === 400) return { status: 'not_found' };
      return { status: 'unavailable', reason: `Places API returned ${response.status}` };
    }

    let raw: RawPlace;
    try {
      raw = (await response.json()) as RawPlace;
    } catch (err) {
      return { status: 'unavailable', reason: this.#redact(err) };
    }

    const summary: PlaceSummary = {
      placeId: str(raw.id) ?? placeId,
      name: str(raw.displayName?.text),
      rating: num(raw.rating),
      userRatingCount: num(raw.userRatingCount),
      googleMapsUri: str(raw.googleMapsUri),
      reviews: Array.isArray(raw.reviews) ? raw.reviews.map(toReview) : [],
      fetchedAt: new Date(this.#now()).toISOString(),
    };

    return { status: 'ok', summary };
  }

  #redact(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    const key = this.#apiKey;
    return key ? message.split(key).join('[redacted]') : message;
  }
}

let singleton: PlacesClient | null = null;

/**
 * The process-wide client. Reads GOOGLE_PLACES_API_KEY — deliberately NOT
 * NEXT_PUBLIC_*, because a browser-readable Maps key is a key anyone can spend.
 * Every call site must therefore be server-side.
 */
export function placesClient(): PlacesClient {
  if (!singleton) {
    singleton = new PlacesClient({ apiKey: process.env['GOOGLE_PLACES_API_KEY'] });
  }
  return singleton;
}
