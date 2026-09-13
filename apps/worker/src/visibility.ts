import {
  analyseWebsite,
  compositeScore,
  type CompositeResult,
  type PageSpeedSummary,
  type PillarInput,
  type WebsiteAnalysis,
} from '@agastyaone/visibility-engine';
import { computeAiVisibilityScore, type EngineRun } from '@agastyaone/ai-visibility-engine';
import type { JsonObject } from '@agastyaone/visibility-engine';
import { browserPool } from './browser.ts';
import { CONFIG } from './config.ts';
import { db, loadLatestGeoRuns, loadLatestMapScanScores } from './store.ts';

export interface VisibilityRun {
  composite: CompositeResult;
  website: WebsiteAnalysis | null;
  websiteUrl: string | null;
}

/** Prepend a scheme if the stored value was typed without one. */
function toNavigableUrl(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/**
 * Google's own Lighthouse run for this URL.
 *
 * Free at 25k requests/day, which is far beyond anything this platform will
 * need — so the website pillar gets Google's own verdict on the page rather
 * than our guess at it. Returns null on any failure, including no key and a
 * rate limit: the pillar then scores on the signals we read ourselves, and the
 * PageSpeed checks drop out of the denominator instead of failing.
 */
async function fetchPageSpeed(url: string): Promise<PageSpeedSummary | null> {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', 'mobile');
  for (const category of ['performance', 'seo', 'accessibility']) {
    endpoint.searchParams.append('category', category);
  }
  if (CONFIG.pageSpeedApiKey) endpoint.searchParams.set('key', CONFIG.pageSpeedApiKey);

  try {
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(CONFIG.pageSpeedTimeoutMs),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number | null } | undefined>;
        audits?: Record<string, { numericValue?: number | null } | undefined>;
      };
    };

    const categories = body.lighthouseResult?.categories ?? {};
    const audits = body.lighthouseResult?.audits ?? {};
    // Lighthouse reports categories 0-1; every other score in this platform is
    // 0-100, so normalise here rather than leaking two scales into the engine.
    const pct = (key: string): number | null => {
      const score = categories[key]?.score;
      return typeof score === 'number' ? Math.round(score * 100) : null;
    };
    const numeric = (key: string): number | null => {
      const value = audits[key]?.numericValue;
      return typeof value === 'number' ? value : null;
    };

    return {
      performance: pct('performance'),
      seo: pct('seo'),
      accessibility: pct('accessibility'),
      lcpMs: numeric('largest-contentful-paint'),
      cls: numeric('cumulative-layout-shift'),
    };
  } catch {
    return null;
  }
}

/**
 * Read the clinic's homepage and score it.
 *
 * Uses the same pooled browser as the directory adapters rather than a plain
 * fetch, because a clinic site is very often a JavaScript-rendered template
 * whose raw HTML carries almost none of the content a search engine or an AI
 * engine would actually see.
 */
async function analyseHomepage(url: string): Promise<WebsiteAnalysis | null> {
  return browserPool.withContext(async (ctx) => {
    const page = await ctx.newPage();
    try {
      const [, psi] = await Promise.all([
        page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.pageTimeoutMs }),
        fetchPageSpeed(url),
      ]);
      const html = await page.content();
      const text = await page.locator('body').innerText().catch(() => '');
      return analyseWebsite(html, text, psi);
    } catch {
      // Unreachable or timed out. Null, never a zero: the pillar goes
      // unmeasured and coverage falls, exactly as an errored directory does.
      return null;
    } finally {
      await page.close().catch(() => {});
    }
  });
}

/**
 * Citations pillar, read from the NAP audit that already ran.
 *
 * Deliberately does not trigger one. A visibility audit reports the state of
 * the world as last measured; making it run a full directory crawl would turn
 * a page fetch into a multi-minute job and duplicate work the client may have
 * already paid for this month.
 */
async function citationsPillar(locationId: string): Promise<number | null> {
  const { data } = await db
    .from('nap_audits')
    .select('audit_score')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.audit_score ?? null;
}

/**
 * Reviews pillar, from the review-request funnel.
 *
 * This measures whether the review programme is working — what share of issued
 * codes got scanned — and NOT the clinic's rating or review count. Those come
 * from Google, may be displayed live but never stored (a snapshot row is
 * storage), and a stored score derived from them would be the same violation
 * wearing a hat. Reputation scoring waits for Google Business Profile API
 * access, at which point this pillar gains a second input.
 */
/**
 * AI answer-engine pillar, from whatever geo_runs already exist.
 *
 * Reads, never triggers. Enqueuing fresh checks here would make a visibility
 * audit block on four LLM calls per active prompt, when the whole point of a
 * separate geo_runs queue (0028) is that those checks run on their own
 * cadence. Same "read the latest, don't re-run" relationship citations
 * already has with nap_audits.
 */
async function aiVisibilityPillar(
  locationId: string,
): Promise<{ score: number | null; detail: JsonObject }> {
  const rows = await loadLatestGeoRuns(locationId);
  const runs: EngineRun[] = rows.map((r) => ({
    engine: r.engine as EngineRun['engine'],
    wasMentioned: r.wasMentioned,
    position: r.position,
  }));

  const result = computeAiVisibilityScore(runs);
  return {
    score: result.score,
    detail: { mentionRate: result.mentionRate, runsConsidered: result.runsConsidered },
  };
}

/**
 * Map-rank pillar, from whatever scans already exist. Also a read, not a
 * trigger, for the same reason: a keyword grid scan is a paced, multi-minute,
 * cost-bearing job, and a visibility audit must stay a page fetch plus a few
 * queries, not something that waits on it.
 */
async function mapRankPillar(locationId: string): Promise<{ score: number | null; detail: JsonObject }> {
  const scores = await loadLatestMapScanScores(locationId);
  if (scores.length === 0) return { score: null, detail: { reason: 'no completed scan yet' } };
  const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { score, detail: { keywordsConsidered: scores.length } };
}

async function reviewsPillar(locationId: string): Promise<number | null> {
  const { data } = await db
    .from('metric_snapshots')
    .select('value')
    .eq('location_id', locationId)
    .eq('metric_code', 'review_click_rate')
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.value ?? null;
}

export async function runVisibilityAudit(
  locationId: string,
  websiteUrl: string | null,
): Promise<VisibilityRun> {
  const url = websiteUrl ? toNavigableUrl(websiteUrl) : null;

  const [website, citations, reviews, aiVisibility, mapRank] = await Promise.all([
    url ? analyseHomepage(url) : Promise.resolve(null),
    citationsPillar(locationId),
    reviewsPillar(locationId),
    aiVisibilityPillar(locationId),
    mapRankPillar(locationId),
  ]);

  const pillars: PillarInput[] = [
    {
      pillar: 'website',
      score: website?.score ?? null,
      detail: website
        ? { seo: website.seo, geo: website.geo, aeo: website.aeo, url }
        : { url, reason: url ? 'unreachable' : 'no website on file' },
    },
    { pillar: 'citations', score: citations, detail: { basis: 'latest completed NAP audit' } },
    { pillar: 'reviews', score: reviews, detail: { basis: 'review request scan rate' } },
    { pillar: 'ai_visibility', score: aiVisibility.score, detail: aiVisibility.detail },
    { pillar: 'map_rank', score: mapRank.score, detail: mapRank.detail },
    // Not built yet. Recorded as unmeasured so the client can see what is
    // still coming rather than wondering why a six-pillar score shows five.
    { pillar: 'backlinks', score: null, detail: { reason: 'not measured yet' } },
  ];

  return { composite: compositeScore(pillars), website, websiteUrl: url };
}
