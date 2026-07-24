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
    const searchQuery = `${source.businessName} ${source.city}`;
    const searchUrl = `https://www.sulekha.com/search?q=${encodeURIComponent(searchQuery)}`;

    try {
      const { browser } = await BrowserFactory.getBrowser();
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: options?.pageTimeout || 15000 });

      const foundName = await page.locator('.biz-name, .listing-title, h3').first().innerText().catch(() => '');
      const foundAddress = await page.locator('.address-info, .location').first().innerText().catch(() => '');
      const foundPhone = await page.locator('.contact-number, .call-btn').first().innerText().catch(() => '');

      await browser.close();

      return {
        directoryId: this.directoryId,
        directoryName: this.directoryName,
        listingUrl: searchUrl,
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
