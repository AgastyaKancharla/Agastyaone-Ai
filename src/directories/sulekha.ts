import { BaseDirectoryProvider } from './baseDirectory';
import { SourceOfTruthNAP, ScrapedListing } from '../types/nap';
import { BrowserFactory } from '../utils/browser';

export class SulekhaDirectoryProvider extends BaseDirectoryProvider {
  readonly directoryId = 'sulekha';
  readonly directoryName = 'Sulekha';
  readonly domain = 'sulekha.com';

  async searchAndScrape(
    source: SourceOfTruthNAP,
    options?: { pageTimeout?: number }
  ): Promise<ScrapedListing | null> {
    const searchQuery = `${source.businessName || ''} ${source.city || ''}`.trim();
    const searchUrl = `https://www.sulekha.com/search?q=${encodeURIComponent(searchQuery)}`;

    let browser;
    try {
      ({ browser } = await BrowserFactory.getBrowser());
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: options?.pageTimeout || 15000 });

      const foundName = await page.locator('.biz-name, .listing-title, h3').first().innerText().catch(() => '');
      const foundAddress = await page.locator('.address-info, .location').first().innerText().catch(() => '');
      const foundPhone = await page.locator('.contact-number, .call-btn').first().innerText().catch(() => '');

      if (!foundName && !foundAddress) {
        return null;
      }

      return {
        directoryId: this.directoryId,
        directoryName: this.directoryName,
        listingUrl: searchUrl,
        foundName: foundName.trim(),
        foundAddress: foundAddress.trim(),
        foundPhone: foundPhone.trim()
      };
    } catch (err: any) {
      // Do NOT fall back to source-of-truth data here — that would report a
      // scrape failure as a "found, consistent" listing, which is worse than
      // useless for a NAP audit. Surface the failure so it shows as ERROR.
      throw new Error(`Sulekha scrape failed: ${err.message || err}`);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}
