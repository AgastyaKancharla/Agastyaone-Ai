import type { BrowserContext } from 'playwright-core';
import type { Candidate, SourceOfTruth } from '@agastyaone/nap-engine';

/**
 * A directory adapter returns CANDIDATES, plural — it does not decide which
 * listing is the business.
 *
 * That separation is the point. The retired tool let each adapter pick
 * `.first()` off the search page and treated it as fact, so a competitor's
 * listing could be diffed against the client. Adapters now scrape what they
 * see; `selectMatch()` in the engine decides whether any of it is confidently
 * this business, and refuses to pick when two candidates look alike.
 */
export interface DirectoryAdapter {
  readonly code: string;
  readonly name: string;
  /** Return up to `limit` plausible listings, best-effort, newest markup first. */
  search(ctx: BrowserContext, source: SourceOfTruth, limit: number): Promise<Candidate[]>;
}

/**
 * Try selectors in order and return the first that yields text.
 *
 * Directory markup changes without notice and these sites ship obfuscated,
 * build-hashed class names (the retired adapters keyed off things like
 * `.jsx-3098522197`, which is a build artifact and breaks on every deploy).
 * A list of fallbacks degrades to "field missing" instead of failing the whole
 * scrape, and "missing" is a legitimate audit finding rather than an error.
 */
export async function firstText(
  scope: { locator: (s: string) => { first: () => { textContent: () => Promise<string | null> } } },
  selectors: string[],
): Promise<string | undefined> {
  for (const sel of selectors) {
    try {
      const text = await scope.locator(sel).first().textContent();
      const trimmed = text?.trim();
      if (trimmed) return trimmed;
    } catch {
      // Selector missing or detached — try the next.
    }
  }
  return undefined;
}

export async function firstAttr(
  scope: { locator: (s: string) => { first: () => { getAttribute: (a: string) => Promise<string | null> } } },
  selectors: string[],
  attr: string,
): Promise<string | undefined> {
  for (const sel of selectors) {
    try {
      const v = await scope.locator(sel).first().getAttribute(attr);
      if (v?.trim()) return v.trim();
    } catch {
      // as above
    }
  }
  return undefined;
}

/** Search string a human would type: name plus the most identifying locality. */
export function searchQuery(source: SourceOfTruth): string {
  return [source.businessName, source.locality, source.city].filter(Boolean).join(' ');
}
