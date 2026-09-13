import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAiProvider } from '../src/openai.ts';
import { GeminiProvider } from '../src/gemini.ts';
import { PerplexityProvider } from '../src/perplexity.ts';
import { AnthropicProvider } from '../src/anthropic.ts';

/** No network: fetch is injected, so quota exhaustion and malformed bodies are exercised deterministically. */
function stubFetch(
  impl: (url: string, init?: RequestInit) => Response,
): { fetch: typeof fetch; calls: { url: string; init: RequestInit | undefined }[] } {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return impl(url, init);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('all four providers report unconfigured without a key, and never touch the network', async () => {
  const stub = stubFetch(() => { throw new Error('must not fetch'); });
  const providers = [
    new OpenAiProvider({ fetchImpl: stub.fetch }),
    new GeminiProvider({ fetchImpl: stub.fetch }),
    new PerplexityProvider({ fetchImpl: stub.fetch }),
    new AnthropicProvider({ fetchImpl: stub.fetch }),
  ];
  for (const p of providers) {
    assert.equal(p.configured, false);
    const outcome = await p.collect({ prompt: 'best dentist in Koramangala' });
    assert.equal(outcome.status, 'error');
    assert.equal(stub.calls.length, 0);
  }
});

test('OpenAI extracts the chat completion text', async () => {
  const stub = stubFetch(() => json({ choices: [{ message: { content: 'Try Smile Dental Clinic.' } }] }));
  const p = new OpenAiProvider({ apiKey: 'k', fetchImpl: stub.fetch });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status, 'ok');
  assert.equal(outcome.status === 'ok' && outcome.text, 'Try Smile Dental Clinic.');
  assert.match(String(stub.calls[0]?.init?.headers && (stub.calls[0].init.headers as Record<string, string>).Authorization), /Bearer k/);
});

test('Gemini extracts text from the nested candidates path', async () => {
  const stub = stubFetch(() =>
    json({ candidates: [{ content: { parts: [{ text: 'Smile Dental Clinic is well reviewed.' }] } }] }),
  );
  const p = new GeminiProvider({ apiKey: 'k', fetchImpl: stub.fetch });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status, 'ok');
  assert.equal(outcome.status === 'ok' && outcome.text, 'Smile Dental Clinic is well reviewed.');
  assert.ok(stub.calls[0]?.url.includes('key=k'), 'Gemini authenticates via the URL, not a header');
});

test('a safety-filtered Gemini response with no candidates is an error, not a mention of nothing', async () => {
  const stub = stubFetch(() => json({ candidates: [] }));
  const p = new GeminiProvider({ apiKey: 'k', fetchImpl: stub.fetch });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status, 'error');
});

test('Perplexity surfaces citations as citedUrls', async () => {
  const stub = stubFetch(() =>
    json({
      choices: [{ message: { content: 'Smile Dental Clinic [1] is a solid option.' } }],
      citations: ['https://smiledental.example'],
    }),
  );
  const p = new PerplexityProvider({ apiKey: 'k', fetchImpl: stub.fetch });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status, 'ok');
  assert.deepEqual(outcome.status === 'ok' ? outcome.citedUrls : undefined, ['https://smiledental.example']);
});

test('Perplexity with no citations field omits citedUrls rather than inventing an empty claim', async () => {
  const stub = stubFetch(() => json({ choices: [{ message: { content: 'Smile Dental Clinic is solid.' } }] }));
  const p = new PerplexityProvider({ apiKey: 'k', fetchImpl: stub.fetch });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status === 'ok' ? outcome.citedUrls : 'not-ok', undefined);
});

test('Claude extracts text from the content block and authenticates via x-api-key', async () => {
  const stub = stubFetch(() => json({ content: [{ type: 'text', text: 'Smile Dental Clinic is a good choice.' }] }));
  const p = new AnthropicProvider({ apiKey: 'k', fetchImpl: stub.fetch });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status, 'ok');
  const headers = stub.calls[0]?.init?.headers as Record<string, string>;
  assert.equal(headers['x-api-key'], 'k');
  assert.equal(headers['anthropic-version'], '2023-06-01');
});

test('every provider treats HTTP 429 as blocked, never as "not mentioned"', async () => {
  const stub = stubFetch(() => json({ error: 'rate limited' }, 429));
  const providers = [
    new OpenAiProvider({ apiKey: 'k', fetchImpl: stub.fetch }),
    new GeminiProvider({ apiKey: 'k', fetchImpl: stub.fetch }),
    new PerplexityProvider({ apiKey: 'k', fetchImpl: stub.fetch }),
    new AnthropicProvider({ apiKey: 'k', fetchImpl: stub.fetch }),
  ];
  for (const p of providers) {
    const outcome = await p.collect({ prompt: 'best dentist' });
    assert.equal(outcome.status, 'blocked', `${p.engine} must report blocked on 429`);
  }
});

test('a network failure is an error, not a crash', async () => {
  const failing = (async () => { throw new Error('ECONNRESET'); }) as typeof globalThis.fetch;
  const p = new OpenAiProvider({ apiKey: 'k', fetchImpl: failing });
  const outcome = await p.collect({ prompt: 'best dentist' });
  assert.equal(outcome.status, 'error');
});

test('each provider reports its own engine identifier', () => {
  assert.equal(new OpenAiProvider().engine, 'chatgpt');
  assert.equal(new GeminiProvider().engine, 'gemini');
  assert.equal(new PerplexityProvider().engine, 'perplexity');
  assert.equal(new AnthropicProvider().engine, 'claude');
});
