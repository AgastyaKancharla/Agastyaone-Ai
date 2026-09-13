import type { AnswerOutcome } from '@agastyaone/ai-visibility-engine';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The one fetch-and-classify path every provider in this package shares.
 *
 * The classification that matters: 429 becomes 'blocked' (try again later,
 * not "the clinic was not mentioned"), any other non-2xx or network failure
 * becomes 'error', and only a 2xx response reaches the caller's own parsing.
 * Getting this wrong anywhere is how a quota limit turns into a client's
 * visibility score silently dropping to zero.
 */
/**
 * A distinct `ok` tag from AnswerOutcome's on purpose. AnswerOutcome's own
 * success variant carries `text`, not `json` — using the same discriminant
 * value for both would give TypeScript two shapes tagged identically and no
 * way to tell them apart at the call site.
 */
export type RawFetchResult =
  | { ok: true; json: unknown }
  | { ok: false; outcome: Extract<AnswerOutcome, { status: 'blocked' | 'error' }> };

export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<RawFetchResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return { ok: false, outcome: { status: 'error', reason: err instanceof Error ? err.message : String(err) } };
  }

  if (response.status === 429) {
    return { ok: false, outcome: { status: 'blocked', reason: 'Rate limited by the provider' } };
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    return {
      ok: false,
      outcome: { status: 'error', reason: `HTTP ${response.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ''}` },
    };
  }

  try {
    return { ok: true, json: await response.json() };
  } catch {
    return { ok: false, outcome: { status: 'error', reason: 'Malformed provider response' } };
  }
}

/** Reads a nested path out of an unknown JSON value without throwing. */
export function pluck(value: unknown, ...path: (string | number)[]): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}
