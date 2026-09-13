import { analyseAnswer, type AiEngine, type AnswerAnalysis, type LlmAnswerProvider } from '@agastyaone/ai-visibility-engine';
import { anthropicProvider, geminiProvider, openAiProvider, perplexityProvider } from '@agastyaone/llm-answer-client';
import { createFixtureLlmProvider } from './collectors/fixture-llm.ts';

export interface GeoRunTarget {
  runId: string;
  tenantId: string;
  locationId: string;
  prompt: string;
  engine: AiEngine;
  businessName: string;
}

/**
 * Buy nothing, build our own — and fall back to the deterministic fixture
 * only when that engine's key is genuinely absent, never as a substitute for
 * a real call that failed. A provider that errors must report that error; it
 * must never quietly return invented text.
 */
export function selectProvider(engine: AiEngine, businessName: string): LlmAnswerProvider {
  switch (engine) {
    case 'chatgpt': {
      const p = openAiProvider();
      return p.configured ? p : createFixtureLlmProvider(engine, businessName);
    }
    case 'gemini': {
      const p = geminiProvider();
      return p.configured ? p : createFixtureLlmProvider(engine, businessName);
    }
    case 'perplexity': {
      const p = perplexityProvider();
      return p.configured ? p : createFixtureLlmProvider(engine, businessName);
    }
    case 'claude': {
      const p = anthropicProvider();
      return p.configured ? p : createFixtureLlmProvider(engine, businessName);
    }
    default:
      return createFixtureLlmProvider(engine, businessName);
  }
}

export interface GeoRunOutcome {
  status: 'completed' | 'blocked' | 'error';
  responseText: string | null;
  analysis: AnswerAnalysis | null;
  errorMessage: string | null;
}

export async function runGeoCheck(target: GeoRunTarget): Promise<GeoRunOutcome> {
  const provider = selectProvider(target.engine, target.businessName);
  const outcome = await provider.collect({ prompt: target.prompt });

  if (outcome.status !== 'ok') {
    return { status: outcome.status, responseText: null, analysis: null, errorMessage: outcome.reason };
  }

  const analysis = analyseAnswer(outcome.text, target.businessName, outcome.citedUrls);
  return { status: 'completed', responseText: outcome.text, analysis, errorMessage: null };
}
