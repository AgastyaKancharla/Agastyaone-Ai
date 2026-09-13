/**
 * Types for the Google Places (New) Place Details response, narrowed to the
 * fields this platform asks for.
 *
 * The result type is a DISCRIMINATED UNION rather than a nullable summary, and
 * that is the load-bearing decision in this package. The retired NAP tool
 * averaged failed directory checks in as zero and dropped a perfect client to
 * 60%; the same mistake here would show a clinic "0.0 ★" because a quota was
 * exceeded. A caller cannot reach `rating` without first narrowing on
 * `status === 'ok'`, so the compiler refuses to let that happen.
 */

export type PlaceReview = {
  /** Google requires the reviewer's name and photo to be displayed with the review. */
  authorName: string | null;
  authorPhotoUri: string | null;
  authorUri: string | null;
  rating: number | null;
  text: string | null;
  /** Google's own wording, e.g. "2 months ago". Display this rather than deriving one. */
  relativeTime: string | null;
  publishedAt: string | null;
  googleMapsUri: string | null;
};

export type PlaceSummary = {
  placeId: string;
  name: string | null;
  rating: number | null;
  userRatingCount: number | null;
  /**
   * Link back to the listing on Google. Maps Platform terms require attribution
   * wherever this content is shown, so it is not optional in the UI.
   */
  googleMapsUri: string | null;
  /** Google's coordinate for the listing — the grid centre for a map scan. */
  latitude: number | null;
  longitude: number | null;
  reviews: PlaceReview[];
  /** When this was fetched. Nothing here is stored, so the UI says how fresh it is. */
  fetchedAt: string;
};

export type PlacesResult =
  | { status: 'ok'; summary: PlaceSummary }
  /** No API key configured. Not an error — the service simply is not connected yet. */
  | { status: 'not_configured' }
  /** The place ID is wrong, or the listing has been removed. */
  | { status: 'not_found' }
  /** Quota, network, or a 5xx. Transient: show "couldn't check", never a score. */
  | { status: 'unavailable'; reason: string };

export type PlacesClientOptions = {
  apiKey?: string | undefined;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined;
  /** In-process cache TTL. A rate guard, not a store. */
  ttlMs?: number | undefined;
  /** Injected for tests so cache expiry is provable without waiting. */
  now?: (() => number) | undefined;
  /** Base URL, overridable for tests. */
  baseUrl?: string | undefined;
};
