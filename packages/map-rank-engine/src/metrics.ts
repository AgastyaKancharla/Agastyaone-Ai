import type { GridMetrics, PointRank } from './types.ts';

/**
 * Below this, a scan is reported but no metric snapshot is written.
 *
 * The single most important rule in this file. A scan that lost a quarter of
 * its points to rate limiting knows almost nothing, and charting it would draw
 * a cliff on the client's trend line that never happened in the world. Missing
 * evidence is not evidence of absence.
 */
export const MIN_COVERAGE_FOR_SNAPSHOT = 80;

/**
 * Per-point visibility weight by rank.
 *
 * Top-heavy on purpose: local-pack click-through collapses after position 3,
 * so ranking 4th is far closer to ranking 10th than to ranking 3rd. A linear
 * weighting would tell a clinic that moving 12th → 8th mattered as much as
 * 4th → 2nd, which is false and would misdirect the work we bill for.
 */
const TOP_WEIGHTS: Record<number, number> = { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.45, 5: 0.35 };

export function visibilityWeight(rank: number, depth: number): number {
  const top = TOP_WEIGHTS[rank];
  if (top !== undefined) return top;
  return Math.max(0, 0.25 * (1 - (rank - 6) / Math.max(1, depth - 5)));
}

/**
 * @param ranks  One entry per SCANNED point. Ambiguous, blocked and errored
 *               points must already have been removed by the caller — they are
 *               missing evidence, and including them in a denominator turns a
 *               scraper problem into a ranking problem.
 * @param depth  Results read per point. Pinned at 20; ATRP is meaningless across
 *               differing depths because the not-found penalty is depth + 1.
 * @param requested Total points in the grid, including those never scanned.
 */
export function computeGridMetrics(ranks: PointRank[], depth: number, requested: number): GridMetrics {
  const scanned = ranks.length;
  const found = ranks.filter((r): r is number => typeof r === 'number');
  const penalty = depth + 1;
  const coveragePct = requested === 0 ? 0 : round2((scanned / requested) * 100);

  if (scanned === 0) {
    return {
      pointsRequested: requested,
      pointsScanned: 0,
      pointsExcluded: requested,
      pointsFound: 0,
      arp: null,
      atrp: penalty,
      solv: 0,
      score: null, // Could not assess. Distinct from "assessed, and invisible".
      coveragePct,
    };
  }

  const inPack = found.filter((r) => r <= 3).length;

  return {
    pointsRequested: requested,
    pointsScanned: scanned,
    pointsExcluded: requested - scanned,
    pointsFound: found.length,
    arp: found.length > 0 ? round2(mean(found)) : null,
    atrp: round2(mean(ranks.map((r) => (typeof r === 'number' ? r : penalty)))),
    solv: round1((100 * inPack) / scanned),
    score: Math.round(
      100 * mean(ranks.map((r) => (typeof r === 'number' ? visibilityWeight(r, depth) : 0))),
    ),
    coveragePct,
  };
}

/** Whether this scan earned a point on the client's trend line. */
export function shouldSnapshot(metrics: GridMetrics): boolean {
  return metrics.score !== null && metrics.coveragePct >= MIN_COVERAGE_FOR_SNAPSHOT;
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
