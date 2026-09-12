import type { AuditSummary, DirectoryResult } from './types.ts';

/**
 * Rolls per-directory results into the numbers a client actually sees.
 *
 * Two things the retired tool got wrong, both of which produced a number that
 * was quietly false rather than obviously broken:
 *
 *  1. `auditScore` averaged confidence across EVERY directory, including
 *     errored ones scoring zero. A blocked Justdial scrape therefore dropped a
 *     perfectly consistent client from 100 to 60, and there was no way to tell
 *     that apart from genuine inconsistency. Errors are now excluded from the
 *     score and surfaced as coverage instead.
 *
 *  2. The counters did not partition the set — `inconsistentCount` also
 *     included drift, and errored directories fell through every bucket, so the
 *     numbers on the report did not add up to the number of directories
 *     checked. Anyone reading it noticed immediately. There is now an
 *     invariant, asserted in the tests: the five status counts sum exactly to
 *     directoriesChecked.
 */
export function summarize(results: DirectoryResult[]): AuditSummary {
  const requested = results.length;
  const errored = results.filter((r) => r.status === 'error');
  const checked = results.filter((r) => r.status !== 'error');

  const count = (s: DirectoryResult['status']) => checked.filter((r) => r.status === s).length;

  // Only listings we could actually read AND confidently attribute carry a
  // confidence number. not_found and ambiguous have nothing to score.
  const scorable = checked.filter((r) => r.overallConfidence !== null);
  const auditScore = scorable.length
    ? Math.round(scorable.reduce((sum, r) => sum + (r.overallConfidence ?? 0), 0) / scorable.length)
    : null;

  return {
    directoriesRequested: requested,
    directoriesChecked: checked.length,
    directoriesErrored: errored.length,
    consistentCount: count('consistent'),
    driftCount: count('drift'),
    inconsistentCount: count('inconsistent'),
    notFoundCount: count('not_found'),
    ambiguousCount: count('ambiguous'),
    auditScore,
    coveragePct: requested === 0 ? 0 : Math.round((checked.length / requested) * 100),
  };
}
