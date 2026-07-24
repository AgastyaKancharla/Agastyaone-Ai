import { BaseDirectoryProvider } from './baseDirectory';
import { SourceOfTruthNAP, ScrapedListing } from '../types/nap';
import { BrowserFactory } from '../utils/browser';

export class PractoDirectoryProvider extends BaseDirectoryProvider {
  readonly directoryId = 'practo';
  readonly directoryName = 'Practo';
  readonly domain = 'practo.com';

  async searchAndScrape(
    source: SourceOfTruthNAP,
    options?: { pageTimeout?: number }
  ): Promise<ScrapedListing | null> {
    const searchQuery = `${source.businessName || ''} ${source.city || ''}`.trim();
    const searchUrl = `https://www.practo.com/search/clinics?results_type=clinic&q=${encodeURIComponent(searchQuery)}&city=${encodeURIComponent(source.city || '')}`;

    let browser;
    try {
      ({ browser } = await BrowserFactory.getBrowser());
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: options?.pageTimeout || 15000 });

      const foundName = await page.locator('.clinic-name, h2[data-qa-id="clinic_name"]').first().innerText().catch(() => '');
      const foundAddress = await page.locator('.locality-address, [data-qa-id="clinic_locality"]').first().innerText().catch(() => '');
      const foundPhone = await page.locator('.phone-number, [data-qa-id="clinic_phone"]').first().innerText().catch(() => '');
      const listingUrl = page.url();

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
    } catch (err: any) {
      // Do NOT fall back to source-of-truth data here — that would report a
      // scrape failure as a "found, consistent" listing, which is worse than
      // useless for a NAP audit. Surface the failure so it shows as ERROR.
      throw new Error(`Practo scrape failed: ${err.message || err}`);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}
