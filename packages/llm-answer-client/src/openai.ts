import type { AnswerOutcome, AnswerRequest, LlmAnswerProvider } from '@agastyaone/ai-visibility-engine';
import { pluck, postJson } from './http.ts';

/**
 * ChatGPT, via OpenAI's Chat Completions API.
 *
 * No system prompt beyond the model's own default: the point is to reproduce
 * what a real patient sees typing the question cold, not to coach the model
 * toward or away from naming any particular clinic.
 */
export class OpenAiProvider implements LlmAnswerProvider {
  readonly engine = 'chatgpt' as const;

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
    this.#model = options.model ?? 'gpt-4o-mini';
    this.#baseUrl = options.baseUrl ?? 'https://api.openai.com/v1/chat/completions';
    this.#fetch = options.fetchImpl ?? fetch;
  }

  get configured(): boolean {
    return this.#apiKey !== '';
  }

  async collect(req: AnswerRequest, signal?: AbortSignal): Promise<AnswerOutcome> {
    if (!this.configured) return { status: 'error', reason: 'OpenAI API key is not configured' };

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
    return { status: 'ok', text };
  }
}

let singleton: OpenAiProvider | null = null;

export function openAiProvider(): OpenAiProvider {
  if (!singleton) {
    singleton = new OpenAiProvider({
      apiKey: process.env['OPENAI_API_KEY'],
      model: process.env['OPENAI_MODEL'],
    });
  }
  return singleton;
}
