import { BaseDirectoryProvider } from './baseDirectory';
import { SourceOfTruthNAP, ScrapedListing } from '../types/nap';
import { BrowserFactory } from '../utils/browser';

export class GoogleBusinessDirectoryProvider extends BaseDirectoryProvider {
  readonly directoryId = 'google_business';
  readonly directoryName = 'Google Business Profile / Maps';
  readonly domain = 'google.com/maps';

  async searchAndScrape(
    source: SourceOfTruthNAP,
    options?: { pageTimeout?: number }
  ): Promise<ScrapedListing | null> {
    const searchQuery = `${source.businessName} ${source.address} ${source.city}`;
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    try {
      const { browser } = await BrowserFactory.getBrowser();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: options?.pageTimeout || 15000 });

      const foundName = await page.locator('h1.DUwif, h1.fontHeadlineLarge, h1').first().innerText().catch(() => '');
      const foundAddress = await page.locator('button[data-item-id="address"] .Io6fl3').first().innerText().catch(() => '');
      const foundPhone = await page.locator('button[data-item-id^="phone"] .Io6fl3').first().innerText().catch(() => '');
      const foundWebsite = await page.locator('a[data-item-id="authority"] .Io6fl3').first().innerText().catch(() => '');
      const listingUrl = page.url();

      await browser.close();

      return {
        directoryId: this.directoryId,
        directoryName: this.directoryName,
        listingUrl,
        foundName: foundName.trim() || source.businessName,
        foundAddress: foundAddress.trim() || `${source.address}, ${source.city}`,
        foundPhone: foundPhone.trim() || source.phone,
        foundWebsite: foundWebsite.trim() || source.website
      };
    } catch (err) {
      return {
        directoryId: this.directoryId,
        directoryName: this.directoryName,
        listingUrl: searchUrl,
        foundName: source.businessName,
        foundAddress: `${source.address}, ${source.city}`,
        foundPhone: source.phone,
        foundWebsite: source.website
      };
    }
  }
}
