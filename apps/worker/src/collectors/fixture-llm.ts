import type { AiEngine, AnswerOutcome, AnswerRequest, LlmAnswerProvider } from '@agastyaone/ai-visibility-engine';

/**
 * A deterministic stand-in for a real answer engine.
 *
 * Selected automatically per engine whenever that engine's API key is absent,
 * so the whole AI-visibility pipeline — queue, worker, mention detection,
 * scoring, UI — is buildable and demonstrable before any of the four API
 * accounts exist, and CI never makes a paid, non-deterministic call to a real
 * LLM. Hashed from the prompt and the clinic's own name, so the same inputs
 * always produce the same answer and a test can assert on it.
 *
 * The competitor names are obviously synthetic on purpose — inventing an
 * answer that names real clinics would put fabricated claims about real
 * businesses into a client-facing product.
 */

const DEMO_COMPETITORS = ['Demo Dental A', 'Demo Dental B', 'Demo Dental C', 'Demo Dental D'];

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createFixtureLlmProvider(engine: AiEngine, clientName: string): LlmAnswerProvider {
  return {
    engine,
    async collect(req: AnswerRequest): Promise<AnswerOutcome> {
      const seed = hash(`${engine}|${req.prompt}|${clientName}`);

      // Roughly one answer in twelve is a refusal with no business named at
      // all, so the "measures nothing" path gets exercised by the demo too.
      if (seed % 12 === 0) {
        return { status: 'ok', text: "I don't have enough information to recommend a specific clinic." };
      }

      // Roughly one in twenty comes back rate-limited.
      if (seed % 20 === 1) {
        return { status: 'blocked', reason: 'Fixture: simulated rate limit' };
      }

      const names = [...DEMO_COMPETITORS];
      const clientRank = seed % 5; // 0..4, sometimes off the list entirely
      if (clientRank < 4) names.splice(clientRank, 0, clientName);

      const lines = names
        .slice(0, 4)
        .map((name, i) => `${i + 1}. ${name} — a well-reviewed option for general and cosmetic dentistry.`);

      return { status: 'ok', text: `Here are a few clinics worth considering:\n\n${lines.join('\n')}` };
    },
  };
}
