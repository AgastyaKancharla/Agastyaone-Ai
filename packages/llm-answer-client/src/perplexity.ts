import type { AnswerOutcome, AnswerRequest, LlmAnswerProvider } from '@agastyaone/ai-visibility-engine';
import { pluck, postJson } from './http.ts';

/**
 * Perplexity — the one engine here that grounds its answer in a live web
 * search and returns the URLs it drew on. Worth building for that reason
 * alone: `citations` lets analyseAnswer() resolve a "[1]" marker next to a
 * mention to the actual page it came from, which none of the other three
 * engines provide.
 */
export class PerplexityProvider implements LlmAnswerProvider {
  readonly engine = 'perplexity' as const;

  readonly #apiKey: string;
  readonly #model: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: {
    apiKey?: string | undefined;
    model?: string | undefined;
    baseUrl?: string | undefined;
    fetchImpl?: typeof fetch | undefined;
  } = {}) {
    this.#apiKey = options.apiKey?.trim() ?? '';
    this.#model = options.model ?? 'sonar';
    this.#baseUrl = options.baseUrl ?? 'https://api.perplexity.ai/chat/completions';
    this.#fetch = options.fetchImpl ?? fetch;
  }

  get configured(): boolean {
    return this.#apiKey !== '';
  }

  async collect(req: AnswerRequest, signal?: AbortSignal): Promise<AnswerOutcome> {
    if (!this.configured) return { status: 'error', reason: 'Perplexity API key is not configured' };

    const result = await postJson(
      this.#baseUrl,
      { Authorization: `Bearer ${this.#apiKey}` },
      { model: this.#model, messages: [{ role: 'user', content: req.prompt }] },
      undefined,
      signal,
      this.#fetch,
    );
    if (!result.ok) return result.outcome;

    const text = pluck(result.json, 'choices', 0, 'message', 'content');
    if (typeof text !== 'string' || text.trim() === '') {
      return { status: 'error', reason: 'No answer text in response' };
    }

    const rawCitations = pluck(result.json, 'citations');
    const citedUrls = Array.isArray(rawCitations)
      ? rawCitations.filter((c): c is string => typeof c === 'string')
      : undefined;

    return { status: 'ok', text, citedUrls };
  }
}

let singleton: PerplexityProvider | null = null;

export function perplexityProvider(): PerplexityProvider {
  if (!singleton) {
    singleton = new PerplexityProvider({
      apiKey: process.env['PERPLEXITY_API_KEY'],
      model: process.env['PERPLEXITY_MODEL'],
    });
  }
  return singleton;
}
