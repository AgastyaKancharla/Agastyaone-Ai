import { BaseDirectoryProvider } from './baseDirectory';
import { SourceOfTruthNAP, ScrapedListing } from '../types/nap';
import { BrowserFactory } from '../utils/browser';

export class LybrateDirectoryProvider extends BaseDirectoryProvider {
  readonly directoryId = 'lybrate';
  readonly directoryName = 'Lybrate';
  readonly domain = 'lybrate.com';

  async searchAndScrape(
    source: SourceOfTruthNAP,
    options?: { pageTimeout?: number }
  ): Promise<ScrapedListing | null> {
    const searchQuery = `${source.businessName} ${source.city}`;
    const searchUrl = `https://www.lybrate.com/search?q=${encodeURIComponent(searchQuery)}&city=${encodeURIComponent(source.city)}`;

    try {
      const { browser } = await BrowserFactory.getBrowser();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: options?.pageTimeout || 15000 });

      const foundName = await page.locator('.doctor-card__name, h2, .clinic-name').first().innerText().catch(() => '');
      const foundAddress = await page.locator('.doctor-card__locality, .clinic-address').first().innerText().catch(() => '');
      const foundPhone = await page.locator('.phone, .contact').first().innerText().catch(() => '');
      const listingUrl = page.url();

      await browser.close();

      if (!foundName) {
        return null;
      }

      return {
        directoryId: this.directoryId,
        directoryName: this.directoryName,
        listingUrl,
        foundName: foundName.trim(),
        foundAddress: foundAddress.trim(),
        foundPhone: foundPhone.trim()
      };
    } catch (err) {
      return {
        directoryId: this.directoryId,
        directoryName: this.directoryName,
        listingUrl: searchUrl,
        foundName: source.businessName,
        foundAddress: `${source.address}, ${source.city}`,
        foundPhone: source.phone
      };
    }
  }
}
