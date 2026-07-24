import { BaseDirectoryProvider } from './baseDirectory';
import { SourceOfTruthNAP, ScrapedListing } from '../types/nap';
import { BrowserFactory } from '../utils/browser';

export class JustdialDirectoryProvider extends BaseDirectoryProvider {
  readonly directoryId = 'justdial';
  readonly directoryName = 'Justdial';
  readonly domain = 'justdial.com';

  async searchAndScrape(
    source: SourceOfTruthNAP,
    options?: { pageTimeout?: number }
  ): Promise<ScrapedListing | null> {
    const searchQuery = `${source.businessName} ${source.city}`;
    const searchUrl = `https://www.justdial.com/${source.city.toLowerCase()}/search?q=${encodeURIComponent(searchQuery)}`;

    try {
      const { browser } = await BrowserFactory.getBrowser();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
      });
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: options?.pageTimeout || 15000 });

      const titleSelector = '.store-name, .jsx-3098522197, h2, .lng_cont_name';
      const addressSelector = '.cont_fl_addr, .address-info, .address';
      const phoneSelector = '.contact-info, .mobilesv, .call-now';

      const foundName = await page.locator(titleSelector).first().innerText().catch(() => '');
      const foundAddress = await page.locator(addressSelector).first().innerText().catch(() => '');
      const foundPhone = await page.locator(phoneSelector).first().innerText().catch(() => '');
      const listingUrl = page.url();

      await browser.close();

      if (!foundName && !foundAddress) {
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
