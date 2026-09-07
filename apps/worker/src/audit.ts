import { evaluateDirectory, summarize, type DirectoryResult, type SourceOfTruth } from '@agastyaone/nap-engine';
import { ADAPTERS } from './adapters/index.ts';
import { browserPool } from './browser.ts';
import { CONFIG } from './config.ts';

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
}> {
  const results = await browserPool.withContext(async (ctx) => {
    const settled = await mapWithConcurrency(ADAPTERS, CONFIG.concurrency, async (adapter) => {
      // Top 5 candidates, not the first hit — the engine decides which, if any,
      // is confidently this business.
      const candidates = await adapter.search(ctx, source, 5);
      return evaluateDirectory(adapter.code, source, candidates);
    });

    return settled.map((r, i): DirectoryResult => {
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
  });

  return { results, summary: summarize(results) };
}
