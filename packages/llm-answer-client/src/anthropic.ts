import type { AnswerOutcome, AnswerRequest, LlmAnswerProvider } from '@agastyaone/ai-visibility-engine';
import { pluck, postJson } from './http.ts';

/** Claude, via Anthropic's Messages API. */
export class AnthropicProvider implements LlmAnswerProvider {
  readonly engine = 'claude' as const;

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
    this.#model = options.model ?? 'claude-sonnet-5';
    this.#baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1/messages';
    this.#fetch = options.fetchImpl ?? fetch;
  }

  get configured(): boolean {
    return this.#apiKey !== '';
  }

  async collect(req: AnswerRequest, signal?: AbortSignal): Promise<AnswerOutcome> {
    if (!this.configured) return { status: 'error', reason: 'Anthropic API key is not configured' };

    const result = await postJson(
      this.#baseUrl,
      { 'x-api-key': this.#apiKey, 'anthropic-version': '2023-06-01' },
      { model: this.#model, max_tokens: 1024, messages: [{ role: 'user', content: req.prompt }] },
      undefined,
      signal,
      this.#fetch,
    );
    if (!result.ok) return result.outcome;

    const text = pluck(result.json, 'content', 0, 'text');
    if (typeof text !== 'string' || text.trim() === '') {
      return { status: 'error', reason: 'No answer text in response' };
    }
    return { status: 'ok', text };
  }
}

let singleton: AnthropicProvider | null = null;

export function anthropicProvider(): AnthropicProvider {
  if (!singleton) {
    singleton = new AnthropicProvider({
      apiKey: process.env['ANTHROPIC_API_KEY'],
      model: process.env['ANTHROPIC_MODEL'],
    });
  }
  return singleton;
}
