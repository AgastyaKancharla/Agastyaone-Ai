import {
  buildGrid,
  computeGridMetrics,
  gridFingerprint,
  PINNED_DEPTH,
  zoomForSpacing,
  type GridMetrics,
  type GridPoint,
  type MapRankProvider,
  type MapsListing,
  type PointRank,
  type PointStatus,
} from '@agastyaone/map-rank-engine';
import { dataForSeoClient } from '@agastyaone/dataforseo-client';
import { selectMatch, type Candidate } from '@agastyaone/nap-engine';
import { createFixtureProvider } from './collectors/fixture-maps.ts';
import { CONFIG } from './config.ts';

export interface ScanTarget {
  scanId: string;
  tenantId: string;
  locationId: string;
  keyword: string;
  businessName: string;
  placeId: string | null;
  centreLat: number;
  centreLng: number;
  gridSize: number;
  spacingM: number;
}

export interface PointResult {
  point: GridPoint;
  status: PointStatus;
  rank: number | null;
  matchedPlaceId: string | null;
  resultCount: number | null;
  errorMessage: string | null;
  /** Top 3 rivals at this point, for the Console's competitor view. */
  competitors: { rank: number; placeId: string | null; name: string; rating: number | null; reviewCount: number | null }[];
}

export interface ScanRun {
  providerCode: string;
  zoom: number;
  fingerprint: string;
  points: PointResult[];
  metrics: GridMetrics;
  costMicros: number;
}

/**
 * Buy the data when we can, simulate it when we cannot.
 *
 * The fixture is not a fallback for a failed call — a real provider that errors
 * must report that error, never quietly substitute invented ranks. It is only
 * selected when no credentials exist at all, so the pipeline is demonstrable
 * before the account is paid for.
 */
export function selectProvider(target: ScanTarget): MapRankProvider {
  const live = dataForSeoClient();
  if (live.configured) return live;

  return createFixtureProvider({
    placeId: target.placeId,
    name: target.businessName,
    centreLat: target.centreLat,
    centreLng: target.centreLng,
  });
}

/**
 * Find the clinic in one point's results.
 *
 * place_id equality first, and it is not a preference: a Maps card carries a
 * truncated address ("Koramangala · 5th Block") and usually no phone, so the
 * fuzzy matcher's evidence collapses to name similarity — and in a grid full of
 * chain clinics that share a brand name, name similarity alone will confidently
 * match the wrong branch. The matcher is kept only for locations with no place
 * connected yet, with thresholds raised to make it admit uncertainty rather
 * than guess.
 */
export function locateBusiness(
  listings: MapsListing[],
  target: ScanTarget,
): { status: Extract<PointStatus, 'found' | 'not_ranked' | 'ambiguous'>; rank: number | null; placeId: string | null } {
  if (target.placeId) {
    const hit = listings.find((l) => l.placeId === target.placeId);
    return hit
      ? { status: 'found', rank: hit.position, placeId: hit.placeId ?? null }
      : { status: 'not_ranked', rank: null, placeId: null };
  }

  const candidates: Candidate[] = listings.map((l) => ({
    name: l.name ?? '',
    address: l.address ?? undefined,
    phone: l.phone ?? undefined,
    website: l.website ?? undefined,
  }));

  const outcome = selectMatch(
    { businessName: target.businessName },
    candidates,
    { accept: 75, margin: 20 },
  );

  if (outcome.kind === 'matched') {
    // `candidates` was built 1:1 from `listings` and the engine passes the same
    // object through on ScoredCandidate.candidate, so identity gives the position.
    const index = candidates.indexOf(outcome.best.candidate);
    const listing = index >= 0 ? listings[index] : undefined;
    return listing
      ? { status: 'found', rank: listing.position, placeId: listing.placeId ?? null }
      : { status: 'not_ranked', rank: null, placeId: null };
  }
  // 'ambiguous' is excluded from the score rather than guessed at: reporting the
  // wrong branch's rank to a client is worse than reporting nothing.
  return {
    status: outcome.kind === 'ambiguous' ? 'ambiguous' : 'not_ranked',
    rank: null,
    placeId: null,
  };
}

/**
 * The measurement parameters, derived before a single lookup is made.
 *
 * Separated so the worker can record them when it marks the scan running,
 * rather than only when it finishes: a 9x9 grid takes minutes, and a Console
 * showing "queued" throughout is a Console nobody trusts. Deterministic from
 * the target and provider, so computing it twice costs nothing and cannot drift.
 */
export function planScan(
  target: ScanTarget,
  provider: MapRankProvider,
): { zoom: number; fingerprint: string; grid: GridPoint[] } {
  const zoom = zoomForSpacing(target.spacingM, target.centreLat);
  return {
    zoom,
    grid: buildGrid(target.centreLat, target.centreLng, target.gridSize, target.spacingM),
    fingerprint: gridFingerprint(
      {
        centreLat: target.centreLat,
        centreLng: target.centreLng,
        size: target.gridSize,
        spacingM: target.spacingM,
        zoom,
        depth: PINNED_DEPTH,
      },
      provider.code,
      target.keyword,
    ),
  };
}

/**
 * Walk the grid.
 *
 * `alreadyDone` carries the points a previous attempt completed. pgmq redelivers
 * a job whose visibility timeout lapsed, and without this a retry would rescan —
 * and rebill — all 81 points. Combined with the per-point upsert in store.ts and
 * the heartbeat that extends the timeout mid-run, a redelivery costs nothing.
 *
 * `onPoint` is called as each point lands so the caller can persist and
 * heartbeat incrementally, rather than holding a whole scan in memory and
 * losing it on a crash.
 */
export async function runMapScan(
  target: ScanTarget,
  provider: MapRankProvider,
  alreadyDone: Map<number, PointResult>,
  onPoint: (result: PointResult) => Promise<void>,
): Promise<ScanRun> {
  const { zoom, fingerprint, grid } = planScan(target, provider);

  const results: PointResult[] = [];
  let costMicros = 0;

  for (const point of grid) {
    const done = alreadyDone.get(point.idx);
    if (done) {
      results.push(done);
      continue;
    }

    const outcome = await provider.collect({
      keyword: target.keyword,
      point,
      zoom,
      depth: PINNED_DEPTH,
      language: 'en',
      regionCode: 'IN',
    });
    costMicros += provider.costMicrosPerPoint;

    let result: PointResult;
    if (outcome.status === 'ok') {
      const located = locateBusiness(outcome.listings, target);
      result = {
        point,
        status: located.status,
        rank: located.rank,
        matchedPlaceId: located.placeId,
        resultCount: outcome.listings.length,
        errorMessage: null,
        competitors: outcome.listings
          .filter((l) => l.placeId !== located.placeId)
          .slice(0, 3)
          .map((l) => ({
            rank: l.position,
            placeId: l.placeId ?? null,
            name: l.name ?? 'Unknown',
            rating: l.rating ?? null,
            reviewCount: l.reviewCount ?? null,
          })),
      };
    } else {
      result = {
        point,
        status: outcome.status,
        rank: null,
        matchedPlaceId: null,
        resultCount: null,
        errorMessage: outcome.reason,
        competitors: [],
      };
    }

    results.push(result);
    await onPoint(result);

    // Pacing. Even a paid API is happier not being hit 81 times in three
    // seconds, and it keeps one runaway scan from starving the other queues.
    if (CONFIG.mapPointDelayMs > 0) {
      await new Promise((r) => setTimeout(r, CONFIG.mapPointDelayMs));
    }
  }

  // Only points we could actually read reach the maths. Blocked, errored and
  // ambiguous points are missing evidence, and including them in a denominator
  // would turn a provider outage into a client's ranking collapse.
  const scored: PointRank[] = results
    .filter((r) => r.status === 'found' || r.status === 'not_ranked')
    .map((r) => (r.status === 'found' && r.rank !== null ? r.rank : 'not_ranked'));

  return {
    providerCode: provider.code,
    zoom,
    fingerprint,
    points: results,
    metrics: computeGridMetrics(scored, PINNED_DEPTH, grid.length),
    costMicros,
  };
}

/** One row per rival per scan — what the Console reads instead of 243 point rows. */
export function rollupCompetitors(points: PointResult[]): {
  placeId: string | null;
  name: string;
  pointsSeen: number;
  avgRank: number;
  solv: number;
}[] {
  const byName = new Map<string, { placeId: string | null; ranks: number[] }>();

  for (const p of points) {
    for (const c of p.competitors) {
      const entry = byName.get(c.name) ?? { placeId: c.placeId, ranks: [] };
      entry.ranks.push(c.rank);
      byName.set(c.name, entry);
    }
  }

  const scannedPoints = points.filter((p) => p.status === 'found' || p.status === 'not_ranked').length;

  return [...byName.entries()]
    .map(([name, entry]) => ({
      placeId: entry.placeId,
      name,
      pointsSeen: entry.ranks.length,
      avgRank: round2(entry.ranks.reduce((a, b) => a + b, 0) / entry.ranks.length),
      solv: scannedPoints === 0 ? 0 : round2((100 * entry.ranks.filter((r) => r <= 3).length) / scannedPoints),
    }))
    .sort((a, b) => b.pointsSeen - a.pointsSeen || a.avgRank - b.avgRank);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
