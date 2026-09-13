import type { BacklinksProvider, SummaryOutcome } from '@agastyaone/backlinks-engine';

/**
 * A deterministic stand-in for the real Backlinks Summary provider.
 *
 * Selected automatically whenever DataForSEO credentials are absent, so the
 * whole pipeline -- queue, worker, scoring, Console, Portal -- is buildable
 * and demonstrable before the account exists, and CI never makes a paid call.
 * Hashed from the domain alone, so the same domain always produces the same
 * summary and a test can assert on it.
 */

/** FNV-1a. Same small, dependency-free hash every other fixture in this codebase uses. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createFixtureBacklinksProvider(): BacklinksProvider {
  return {
    code: 'fixture_backlinks',
    costMicrosPerCheck: 0,

    async collect(domain: string): Promise<SummaryOutcome> {
      const seed = hash(domain);

      // Roughly one in twenty comes back rate-limited.
      if (seed % 20 === 0) {
        return { status: 'blocked', reason: 'Fixture: simulated rate limit' };
      }
      // Roughly one in twenty-five is a domain the provider has crawled
      // nothing for, so the "unmeasured" path gets exercised by the demo too.
      if (seed % 25 === 1) {
        return { status: 'error', reason: 'Fixture: no backlink data available for this domain' };
      }

      // Every ~15th domain is a brand-new site with no links yet at all -- a
      // real, measured zero, not a failure.
      const referringDomains = seed % 15 === 0 ? 0 : (seed % 60) + 1;
      const totalBacklinks =
        referringDomains === 0 ? 0 : referringDomains * (2 + (seed % 5)) + (seed % 7);
      const brokenBacklinks = referringDomains === 0 ? 0 : (seed >> 3) % 4;
      // Mostly clean; occasionally a visibly spammy profile so the penalty
      // path gets exercised too.
      const spamScore = seed % 11 === 0 ? 45 + (seed % 40) : seed % 20;
      const domainRank = referringDomains === 0 ? 0 : Math.min(1000, referringDomains * 6 + (seed % 50));

      return {
        status: 'ok',
        summary: { referringDomains, totalBacklinks, brokenBacklinks, spamScore, domainRank },
        fetchedAt: new Date().toISOString(),
      };
    },
  };
}
