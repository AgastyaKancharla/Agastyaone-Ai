/**
 * Validated at startup rather than read lazily. The retired worker defaulted
 * every value and returned silently when Supabase credentials were missing, so
 * a misconfigured deploy looked like a worker with nothing to do.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const CONFIG = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  /** Connect to a remote Playwright instead of launching locally. */
  playwrightWsEndpoint: process.env.PLAYWRIGHT_WS_ENDPOINT ?? '',
  headless: process.env.HEADLESS !== 'false',

  /** Directories scraped concurrently within one audit. */
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
  /** How long a claimed job stays invisible to other workers. */
  visibilityTimeoutSec: Number(process.env.WORKER_VISIBILITY_TIMEOUT ?? 300),
  pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000),
  pageTimeoutMs: Number(process.env.WORKER_PAGE_TIMEOUT_MS ?? 20000),

  /**
   * Optional. PageSpeed Insights answers unauthenticated at low volume; a key
   * raises the quota to 25k/day. Absent, the website pillar simply scores on
   * the signals we read ourselves.
   */
  pageSpeedApiKey: process.env.PAGESPEED_API_KEY ?? '',
  /** Lighthouse runs a real browser server-side, so this is generous. */
  pageSpeedTimeoutMs: Number(process.env.WORKER_PAGESPEED_TIMEOUT_MS ?? 60000),

  /**
   * Pause between grid points. Paces a scan so one long job cannot starve the
   * other two queues, and keeps a paid provider from being hit 81 times in
   * three seconds.
   */
  mapPointDelayMs: Number(process.env.WORKER_MAP_POINT_DELAY_MS ?? 250),
  /**
   * Visibility timeout for a grid scan, far longer than the other queues: 81
   * paced lookups take minutes, and the default 300s would have pgmq redeliver
   * the job mid-run and bill the scan twice. The worker also heartbeats to
   * extend it further as it goes.
   */
  mapVisibilityTimeoutSec: Number(process.env.WORKER_MAP_VISIBILITY_TIMEOUT ?? 1800),

  /** Attempts before a job is archived to the dead letter. */
  maxAttempts: Number(process.env.WORKER_MAX_ATTEMPTS ?? 3),
} as const;
