import type {
  MapRankProvider,
  MapsListing,
  PointOutcome,
  PointRequest,
} from '@agastyaone/map-rank-engine';

/**
 * DataForSEO Google Maps SERP — one lookup per grid point.
 *
 * WHY THIS IS BOUGHT RATHER THAN SCRAPED
 *
 * A 9x9 grid is 81 Maps lookups per keyword per scan. Scraping that from one
 * datacenter IP gets rate-limited and CAPTCHA'd quickly, and the residential
 * proxy that would keep it alive costs 10-40x more per request than this API.
 * Own-scraping here is the expensive AND fragile option, not the cheap one.
 *
 * WHY LIVE MODE
 *
 * DataForSEO offers a queued mode at roughly a third of the price, but it is a
 * two-step task_post/task_get dance with its own polling and timeout failure
 * modes. A background worker is not latency-sensitive, so the saving is real
 * but the complexity is not worth it at this volume: at 100 clinics scanning 5
 * keywords monthly the difference is about $57 a month. Revisit if that stops
 * being true -- the provider seam means nothing else has to change.
 *
 * TERMS
 *
 * Unlike Google's own Places terms, DataForSEO's results may be stored, which
 * is precisely why the trend history in map_scans is legal to keep.
 */

const DEFAULT_BASE_URL = 'https://api.dataforseo.com/v3';
const DEFAULT_TIMEOUT_MS = 60_000;

/** Live advanced is $0.002 per request. Recorded in millionths of a US dollar. */
const COST_MICROS_PER_POINT = 2_000;

export interface DataForSeoOptions {
  login?: string | undefined;
  password?: string | undefined;
  baseUrl?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
}

/** The subset of the response this reads. Everything else is ignored deliberately. */
type RawItem = {
  type?: string;
  rank_absolute?: number;
  title?: string;
  place_id?: string;
  cid?: string;
  address?: string;
  phone?: string;
  domain?: string;
  url?: string;
  rating?: { value?: number; votes_count?: number };
};

type RawResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: { items?: RawItem[] }[];
  }[];
};

export class DataForSeoClient implements MapRankProvider {
  readonly code = 'dataforseo_maps' as const;
  readonly maxDepth = 100;
  readonly costMicrosPerPoint = COST_MICROS_PER_POINT;

  readonly #login: string;
  readonly #password: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;

  constructor(options: DataForSeoOptions = {}) {
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

  async collect(req: PointRequest, signal?: AbortSignal): Promise<PointOutcome> {
    if (!this.configured) {
      return { status: 'error', reason: 'DataForSEO credentials are not configured' };
    }

    const auth = Buffer.from(`${this.#login}:${this.#password}`).toString('base64');
    const body = JSON.stringify([
      {
        keyword: req.keyword,
        // The whole reason this provider was chosen: it takes the grid point
        // natively, so the swap from any other source changes no semantics.
        location_coordinate: `${req.point.lat},${req.point.lng},${req.zoom}`,
        language_code: req.language,
        depth: Math.min(req.depth, this.maxDepth),
      },
    ]);

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/serp/google/maps/live/advanced`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body,
        signal: signal ?? AbortSignal.timeout(this.#timeoutMs),
      });
    } catch (err) {
      return { status: 'error', reason: err instanceof Error ? err.message : String(err) };
    }

    // 429 is the one status worth distinguishing: it means try again later, not
    // that this clinic ranks nowhere. Everything else is an error, and both are
    // excluded from the score either way.
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

    return {
      status: 'ok',
      listings: toListings(task.result?.[0]?.items ?? []),
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Ads are stripped, then positions are renumbered from 1.
 *
 * `rank_absolute` counts paid placements, so trusting it would record a clinic
 * as 4th when it is organically 2nd — and the number would move whenever a
 * rival started or stopped buying ads, which is not a change in the clinic's
 * ranking and must not appear on their chart as one.
 */
export function toListings(items: RawItem[]): MapsListing[] {
  return items
    .filter((item) => item.type === 'maps_search')
    .map((item, i) => ({
      position: i + 1,
      placeId: item.place_id ?? item.cid ?? undefined,
      name: item.title ?? undefined,
      address: item.address ?? undefined,
      phone: item.phone ?? undefined,
      website: item.url ?? item.domain ?? undefined,
      rating: item.rating?.value ?? undefined,
      reviewCount: item.rating?.votes_count ?? undefined,
    }));
}

let singleton: DataForSeoClient | null = null;

/**
 * The process-wide client. Reads DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD —
 * deliberately not NEXT_PUBLIC_*, since these credentials spend money.
 */
export function dataForSeoClient(): DataForSeoClient {
  if (!singleton) {
    singleton = new DataForSeoClient({
      login: process.env['DATAFORSEO_LOGIN'],
      password: process.env['DATAFORSEO_PASSWORD'],
    });
  }
  return singleton;
}
