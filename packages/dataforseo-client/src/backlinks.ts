import type { BacklinksProvider, BacklinksSummary, SummaryOutcome } from '@agastyaone/backlinks-engine';

const DEFAULT_BASE_URL = 'https://api.dataforseo.com/v3';
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * $0.024 base charge per task plus $0.000036 per row; a summary call returns
 * exactly one row per domain, so this is the effective all-in cost, recorded
 * in millionths of a US dollar like every other provider cost in this codebase.
 */
const COST_MICROS_PER_CHECK = 24_036;

export interface DataForSeoBacklinksOptions {
  login?: string | undefined;
  password?: string | undefined;
  baseUrl?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
}

/** The subset of the response this reads. Everything else -- TLD/type/country breakdowns -- is ignored deliberately. */
type RawResult = {
  rank?: number;
  backlinks?: number;
  referring_domains?: number;
  broken_backlinks?: number;
  backlinks_spam_score?: number;
};

type RawResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: RawResult[];
  }[];
};

export class DataForSeoBacklinksClient implements BacklinksProvider {
  readonly code = 'dataforseo_backlinks' as const;
  readonly costMicrosPerCheck = COST_MICROS_PER_CHECK;

  readonly #login: string;
  readonly #password: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: DataForSeoBacklinksOptions = {}) {
    this.#login = options.login?.trim() ?? '';
    this.#password = options.password?.trim() ?? '';
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  /** True when credentials are configured. Lets the worker pick a provider without a call. */
  get configured(): boolean {
    return this.#login !== '' && this.#password !== '';
  }

  async collect(domain: string, signal?: AbortSignal): Promise<SummaryOutcome> {
    if (!this.configured) {
      return { status: 'error', reason: 'DataForSEO credentials are not configured' };
    }

    const auth = Buffer.from(`${this.#login}:${this.#password}`).toString('base64');
    const body = JSON.stringify([{ target: domain }]);

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/backlinks/summary/live`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body,
        signal: signal ?? AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (err) {
      return { status: 'error', reason: err instanceof Error ? err.message : String(err) };
    }

    if (response.status === 429) {
      return { status: 'blocked', reason: 'Rate limited by the provider' };
    }
    if (!response.ok) {
      return { status: 'error', reason: `HTTP ${response.status}` };
    }

    let raw: RawResponse;
    try {
      raw = (await response.json()) as RawResponse;
    } catch {
      return { status: 'error', reason: 'Malformed provider response' };
    }

    const task = raw.tasks?.[0];
    if (!task) return { status: 'error', reason: raw.status_message ?? 'No task in response' };
    // DataForSEO reports per-task failures in the body with a 200, so the HTTP
    // status alone is not enough to know the lookup succeeded.
    if (task.status_code !== undefined && task.status_code >= 40000) {
      return { status: 'error', reason: task.status_message ?? `Task error ${task.status_code}` };
    }

    const result = task.result?.[0];
    if (!result) {
      // A domain the provider has crawled nothing for. Distinct from a real
      // zero-backlinks summary (which still returns a result row with 0s) --
      // this is "we have no data at all", so it goes unmeasured rather than
      // scored as an invisible site.
      return { status: 'error', reason: 'No backlink data available for this domain' };
    }

    return {
      status: 'ok',
      summary: toSummary(result),
      fetchedAt: new Date().toISOString(),
    };
  }
}

export function toSummary(result: RawResult): BacklinksSummary {
  return {
    referringDomains: result.referring_domains ?? 0,
    totalBacklinks: result.backlinks ?? 0,
    brokenBacklinks: result.broken_backlinks ?? 0,
    spamScore: result.backlinks_spam_score ?? null,
    domainRank: result.rank ?? null,
  };
}

let singleton: DataForSeoBacklinksClient | null = null;

/** The process-wide client. Reads the same DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD as the Maps client -- one account, two products. */
export function dataForSeoBacklinksClient(): DataForSeoBacklinksClient {
  if (!singleton) {
    singleton = new DataForSeoBacklinksClient({
      login: process.env['DATAFORSEO_LOGIN'],
      password: process.env['DATAFORSEO_PASSWORD'],
    });
  }
  return singleton;
}
