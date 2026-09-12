import {
  checkNmcCompliance,
  evaluateDirectory,
  summarize,
  type DirectoryResult,
  type NmcComplianceResult,
  type SourceOfTruth,
} from '@agastyaone/nap-engine';
import { ADAPTERS } from './adapters/index.ts';
import { browserPool } from './browser.ts';
import { CONFIG } from './config.ts';
import type { BrowserContext } from 'playwright-core';

/** Run `limit` promises at a time, preserving input order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const out = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        out[i] = { status: 'fulfilled', value: await fn(items[i]!) };
      } catch (err) {
        out[i] = { status: 'rejected', reason: err };
      }
    }
  });

  await Promise.all(runners);
  return out;
}

/** Prepend a scheme if the stored value was typed without one. */
function toNavigableUrl(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Fetch the client's own homepage once and lint it for NMC/DCI advertising
 * compliance. Returns null rather than a failed result when there is no
 * website on file, or the page could not be reached — the same "coverage,
 * not score-drag" rule the directory adapters use: a site we could not read
 * this time must never be reported to the client as a compliance failure.
 */
async function checkWebsiteCompliance(
  ctx: BrowserContext,
  source: SourceOfTruth,
): Promise<NmcComplianceResult | null> {
  const url = source.website ? toNavigableUrl(source.website) : null;
  if (!url) return null;

  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    const text = await page.locator('body').innerText().catch(() => '');
    return checkNmcCompliance(html, text);
  } catch {
    // Unreachable, timed out, refused a bot — same as a directory adapter
    // erroring: silently uncounted rather than scored as non-compliant.
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Audit one location across every enabled directory.
 *
 * Directories run CONCURRENTLY on one browser, bounded by WORKER_CONCURRENCY.
 * The retired tool ran them serially, each with its own browser cold start,
 * inside the HTTP request — about 75 seconds of a user staring at a spinner.
 *
 * One directory failing never fails the audit: it is recorded as `error`,
 * excluded from the client's score, and surfaced as reduced coverage. That is
 * the honest split between "your listings are inconsistent" and "we could not
 * read one of them".
 */
export async function runAudit(source: SourceOfTruth): Promise<{
  results: DirectoryResult[];
  summary: ReturnType<typeof summarize>;
  compliance: NmcComplianceResult | null;
}> {
  const { results, compliance } = await browserPool.withContext(async (ctx) => {
    const [settled, compliance] = await Promise.all([
      mapWithConcurrency(ADAPTERS, CONFIG.concurrency, async (adapter) => {
        // Top 5 candidates, not the first hit — the engine decides which, if
        // any, is confidently this business.
        const candidates = await adapter.search(ctx, source, 5);
        return evaluateDirectory(adapter.code, source, candidates);
      }),
      checkWebsiteCompliance(ctx, source),
    ]);

    const results = settled.map((r, i): DirectoryResult => {
      if (r.status === 'fulfilled') return r.value;
      const adapter = ADAPTERS[i]!;
      return {
        directoryCode: adapter.code,
        status: 'error',
        found: false,
        listingUrl: null,
        matchConfidence: null,
        runnerUpMargin: null,
        overallConfidence: null,
        isClaimed: null,
        rating: null,
        reviewCount: null,
        diffs: [],
        errorMessage: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
    });

    return { results, compliance };
  });

  return { results, summary: summarize(results), compliance };
}
