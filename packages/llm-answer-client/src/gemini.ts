import type { AnswerOutcome, AnswerRequest, LlmAnswerProvider } from '@agastyaone/ai-visibility-engine';
import { pluck, postJson } from './http.ts';

/** Gemini, via Google's Generative Language API. */
export class GeminiProvider implements LlmAnswerProvider {
  readonly engine = 'gemini' as const;

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
    this.#model = options.model ?? 'gemini-1.5-flash';
    this.#baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta/models';
    this.#fetch = options.fetchImpl ?? fetch;
  }

  get configured(): boolean {
    return this.#apiKey !== '';
  }

  async collect(req: AnswerRequest, signal?: AbortSignal): Promise<AnswerOutcome> {
    if (!this.configured) return { status: 'error', reason: 'Gemini API key is not configured' };

    // The key rides in the URL, not a header — the API's own convention.
    const url = `${this.#baseUrl}/${this.#model}:generateContent?key=${encodeURIComponent(this.#apiKey)}`;
    const result = await postJson(
      url,
      {},
      { contents: [{ parts: [{ text: req.prompt }] }] },
      undefined,
      signal,
      this.#fetch,
    );
    if (!result.ok) return result.outcome;

    const text = pluck(result.json, 'candidates', 0, 'content', 'parts', 0, 'text');
    if (typeof text !== 'string' || text.trim() === '') {
      // A safety block reports here with no candidates rather than an HTTP
      // error, so it must not be misread as "the clinic was not mentioned".
      return { status: 'error', reason: 'No answer text in response (possibly filtered)' };
    }
    return { status: 'ok', text };
  }
}

let singleton: GeminiProvider | null = null;

export function geminiProvider(): GeminiProvider {
  if (!singleton) {
    singleton = new GeminiProvider({
      apiKey: process.env['GEMINI_API_KEY'],
      model: process.env['GEMINI_MODEL'],
    });
  }
  return singleton;
}
