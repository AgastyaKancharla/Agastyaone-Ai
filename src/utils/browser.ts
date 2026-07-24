import { chromium, Browser } from 'playwright-core';
import { CONFIG } from '../config/env';

export class BrowserFactory {
  /**
   * Spawns a Chromium browser instance — either running self-contained inside
   * our Docker container or connecting to our self-hosted Playwright server.
   */
  static async getBrowser(): Promise<{ browser: Browser }> {
    if (CONFIG.PLAYWRIGHT_WS_ENDPOINT) {
      console.log(`🌐 Connecting to Self-Hosted Playwright cluster at ${CONFIG.PLAYWRIGHT_WS_ENDPOINT}...`);
      const browser = await chromium.connect(CONFIG.PLAYWRIGHT_WS_ENDPOINT);
      return { browser };
    }

    console.log('🚀 Launching Self-Hosted Container Chromium...');
    try {
      const browser = await chromium.launch({
        headless: CONFIG.HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      return { browser };
    } catch (err: any) {
      console.warn('⚠️ Chromium launch failed:', err.message);
      throw new Error(`Browser engine error: ${err.message || 'Chromium binary unavailable in environment'}`);
    }
  }
}
