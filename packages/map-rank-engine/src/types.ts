/** One cell of the scan grid. `idx` is row-major and is the stable key for resuming a scan. */
export interface GridPoint {
  idx: number;
  row: number;
  col: number;
  lat: number;
  lng: number;
}

export interface MapsListing {
  /** 1-based position among ORGANIC listings. Ads are stripped before ranking. */
  position: number;
  /** The only reliable identity. Everything else on a Maps card is truncated or absent. */
  placeId?: string | undefined;
  name?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  rating?: number | undefined;
  reviewCount?: number | undefined;
}

export interface PointRequest {
  keyword: string;
  point: GridPoint;
  zoom: number;
  /** Results read per point. PINNED AT 20 FOREVER — see ATRP in metrics.ts. */
  depth: number;
  language: string;
  regionCode: string;
}

/**
 * Discriminated on purpose, exactly like `PlacesResult` in packages/places-client.
 *
 * A caller cannot reach `listings` without narrowing first, so a blocked point
 * can never be silently read as "rank 0" — which is the failure that would turn
 * a rate limit into a client's ranking collapse.
 */
export type PointOutcome =
  | { status: 'ok'; listings: MapsListing[]; fetchedAt: string }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; reason: string };

export interface MapRankProvider {
  readonly code: 'dataforseo_maps' | 'fixture_maps';
  readonly maxDepth: number;
  /** Cost per point in millionths of a rupee, recorded per scan attempt. */
  readonly costMicrosPerPoint: number;
  collect(req: PointRequest, signal?: AbortSignal): Promise<PointOutcome>;
}

/** What happened at one point, once identity has been resolved. */
export type PointStatus = 'found' | 'not_ranked' | 'ambiguous' | 'blocked' | 'error';

/**
 * A scanned point's contribution to the score.
 *
 * Only 'found' and 'not_ranked' appear here — ambiguous, blocked and errored
 * points are removed from every denominator before the maths runs, the same way
 * summarize() in nap-engine excludes errored directories.
 */
export type PointRank = number | 'not_ranked';

export interface GridMetrics {
  pointsRequested: number;
  pointsScanned: number;
  pointsExcluded: number;
  pointsFound: number;
  /** Mean rank where found. Null when found nowhere — never 0, never depth. */
  arp: number | null;
  /** Mean across all scanned points, not-found scored at depth + 1. Comparable only at a fixed depth. */
  atrp: number;
  /** Percentage of scanned points ranking 1-3. The metric that tracks clicks. */
  solv: number;
  /** 0-100 pillar sub-score. Null means "could not assess", which is not zero. */
  score: number | null;
  /** Share of requested points actually scanned. Below 80, no snapshot is written. */
  coveragePct: number;
}

export interface GridSpec {
  centreLat: number;
  centreLng: number;
  size: number;
  spacingM: number;
  zoom: number;
  depth: number;
}
