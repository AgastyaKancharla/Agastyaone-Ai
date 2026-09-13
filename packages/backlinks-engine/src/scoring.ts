import type { BacklinksResult, BacklinksSummary } from './types.ts';

/**
 * Referring domains this practice would need for a strong LOCAL backlink
 * profile -- health directories, the local paper, a few patient blogs. Not
 * an enterprise SEO benchmark: a single-location clinic realistically tops
 * out here, so the curve should reward reaching it, not treat it as a floor.
 */
const REFERRING_DOMAINS_TARGET = 50;

/** DataForSEO's own spam_score is 0-100; under this is unremarkable for any real site. */
const SPAM_SCORE_SAFE_THRESHOLD = 30;

/**
 * Log-scaled on purpose: going from 0 to 5 referring domains is a real
 * milestone for a single-location practice, while 50 to 55 is noise. A linear
 * scale would make the two look equally significant, which is not how link
 * building difficulty actually grows.
 */
function domainsScore(referringDomains: number): number {
  if (referringDomains <= 0) return 0;
  const ratio = Math.log10(referringDomains + 1) / Math.log10(REFERRING_DOMAINS_TARGET + 1);
  return Math.min(100, Math.round(ratio * 100));
}

/**
 * A visibly spammy link profile is the one actionable warning in this pillar
 * -- "consider disavowing" is real advice for a clinic, unlike chasing a
 * vendor's raw domain-rank number. No penalty below the safe threshold; capped
 * so one bad batch of links cannot swing the score to zero on its own.
 */
function spamPenalty(spamScore: number | null): number {
  if (spamScore === null || spamScore <= SPAM_SCORE_SAFE_THRESHOLD) return 0;
  return Math.min(40, Math.round((spamScore - SPAM_SCORE_SAFE_THRESHOLD) * 0.8));
}

/**
 * @param summary The latest completed check for this location. Null means no
 *   check has ever completed -- unmeasured, not zero -- the same rule every
 *   pillar in this product follows. Zero referring domains from a completed
 *   check is a real, measured absence and scores 0.
 */
export function computeBacklinksScore(summary: BacklinksSummary | null): BacklinksResult {
  if (summary === null) {
    return { score: null, referringDomains: null, totalBacklinks: null, spamScore: null };
  }

  const score = Math.max(0, domainsScore(summary.referringDomains) - spamPenalty(summary.spamScore));

  return {
    score,
    referringDomains: summary.referringDomains,
    totalBacklinks: summary.totalBacklinks,
    spamScore: summary.spamScore,
  };
}
