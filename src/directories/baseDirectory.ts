import { SourceOfTruthNAP, ScrapedListing } from '../types/nap';

export abstract class BaseDirectoryProvider {
  abstract readonly directoryId: string;
  abstract readonly directoryName: string;
  abstract readonly domain: string;

  /**
   * Searches for a business listing on this directory and extracts NAP data.
   */
  abstract searchAndScrape(
    source: SourceOfTruthNAP,
    options?: { pageTimeout?: number }
  ): Promise<ScrapedListing | null>;
}
