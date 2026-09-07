import { chromium, type Browser, type BrowserContext } from 'playwright-core';
import { CONFIG } from './config.ts';

/**
 * One browser for the process, a fresh context per audit.
 *
 * The retired tool launched and tore down a whole Chromium per directory, in
 * series — five cold starts for one audit, ~75s worst case, and it leaked
 * processes whenever a page load threw before the close call. A browser costs
 * hundreds of milliseconds to start and a context costs almost nothing, so
 * pooling the expensive thing and isolating with the cheap one is both faster
 * and cleaner: contexts do not share cookies or storage, so one directory's
 * session cannot bleed into another's.
 */
class BrowserPool {
  #browser: Browser | null = null;
  #starting: Promise<Browser> | null = null;

  async get(): Promise<Browser> {
    if (this.#browser?.isConnected()) return this.#browser;
    // Collapse concurrent starts, or a burst of jobs launches N browsers.
    this.#starting ??= this.#launch();
    try {
      this.#browser = await this.#starting;
      return this.#browser;
    } finally {
      this.#starting = null;
    }
  }

  async #launch(): Promise<Browser> {
    if (CONFIG.playwrightWsEndpoint) {
      return chromium.connect(CONFIG.playwrightWsEndpoint);
    }
    return chromium.launch({
      headless: CONFIG.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Containers give /dev/shm 64MB by default, which Chromium exhausts and
        // then crashes with an opaque error.
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });
  }

  /** A context per audit, always closed — including when the work throws. */
  async withContext<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
    const browser = await this.get();
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      viewport: { width: 1366, height: 900 },
    });
    ctx.setDefaultTimeout(CONFIG.pageTimeoutMs);
    try {
      return await fn(ctx);
    } finally {
      await ctx.close().catch(() => {});
    }
  }

  async close(): Promise<void> {
    await this.#browser?.close().catch(() => {});
    this.#browser = null;
  }
}

export const browserPool = new BrowserPool();
