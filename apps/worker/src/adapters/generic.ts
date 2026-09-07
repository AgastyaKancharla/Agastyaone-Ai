import type { BrowserContext } from 'playwright-core';
import type { Candidate, SourceOfTruth } from '@agastyaone/nap-engine';
import { firstAttr, firstText, searchQuery, type DirectoryAdapter } from './types.ts';

export interface ListingSelectors {
  /** Rows on the search results page. Tried in order. */
  card: string[];
  name: string[];
  address: string[];
  phone: string[];
  link: string[];
  rating?: string[];
  reviewCount?: string[];
}

/**
 * Most Indian directories present the same shape — a list of result cards with
 * a name, an address, sometimes a phone — so the traversal is shared and each
 * adapter supplies only its URL template and selectors.
 *
 * This is deliberately tolerant. Any field can come back undefined, and that is
 * reported as a missing field rather than thrown, because "this listing has no
 * phone number" is one of the findings the audit exists to surface.
 *
 * What is NOT tolerated is a page that fails to load at all: that throws, and
 * the caller records the directory as `error`, excluded from the client's score
 * and reported as reduced coverage instead.
 */
export function createAdapter(opts: {
  code: string;
  name: string;
  searchUrl: (source: SourceOfTruth) => string;
  selectors: ListingSelectors;
  /** Turn a card's href into an absolute listing URL. */
  absoluteUrl?: (href: string) => string;
}): DirectoryAdapter {
  return {
    code: opts.code,
    name: opts.name,
    async search(ctx: BrowserContext, source: SourceOfTruth, limit: number): Promise<Candidate[]> {
      const page = await ctx.newPage();
      try {
        await page.goto(opts.searchUrl(source), { waitUntil: 'domcontentloaded' });

        // Find whichever card selector this deploy of the site is using.
        let cards = null;
        for (const sel of opts.selectors.card) {
          const loc = page.locator(sel);
          if ((await loc.count()) > 0) {
            cards = loc;
            break;
          }
        }
        if (!cards) return []; // no results — a real finding, not an error

        const total = Math.min(await cards.count(), limit);
        const out: Candidate[] = [];

        for (let i = 0; i < total; i++) {
          const card = cards.nth(i);
          const href = await firstAttr(card, opts.selectors.link, 'href');

          // The listing's own URL, never the search URL. The retired tool set
          // this to page.url() and then used its presence as the "found" test,
          // so every result read as found.
          const listingUrl = href
            ? opts.absoluteUrl
              ? opts.absoluteUrl(href)
              : new URL(href, page.url()).toString()
            : undefined;

          const ratingText = opts.selectors.rating ? await firstText(card, opts.selectors.rating) : undefined;
          const reviewText = opts.selectors.reviewCount ? await firstText(card, opts.selectors.reviewCount) : undefined;

          out.push({
            listingUrl,
            name: await firstText(card, opts.selectors.name),
            address: await firstText(card, opts.selectors.address),
            phone: await firstText(card, opts.selectors.phone),
            rating: ratingText ? Number.parseFloat(ratingText.replace(/[^\d.]/g, '')) || undefined : undefined,
            reviewCount: reviewText ? Number.parseInt(reviewText.replace(/[^\d]/g, ''), 10) || undefined : undefined,
          });
        }
        return out;
      } finally {
        await page.close().catch(() => {});
      }
    },
  };
}

export const q = (source: SourceOfTruth) => encodeURIComponent(searchQuery(source));
