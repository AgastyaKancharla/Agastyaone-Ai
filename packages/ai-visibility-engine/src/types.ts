export type AiEngine = 'chatgpt' | 'perplexity' | 'gemini' | 'claude' | 'copilot' | 'other';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface AnswerRequest {
  prompt: string;
}

/**
 * Discriminated on purpose, the same shape as PlacesResult and PointOutcome:
 * a caller cannot reach `text` without narrowing first, so a rate-limited
 * provider can never be silently read as "the clinic was not mentioned".
 */
export type AnswerOutcome =
  | { status: 'ok'; text: string; citedUrls?: string[] | undefined }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; reason: string };

export interface LlmAnswerProvider {
  readonly engine: AiEngine;
  collect(req: AnswerRequest, signal?: AbortSignal): Promise<AnswerOutcome>;
}

export interface Mention {
  entityName: string;
  isClient: boolean;
  /** Position within a detected list. Null when mentioned in prose with no list structure. */
  position: number | null;
  citedUrl: string | null;
  sentiment: Sentiment | null;
}

export interface AnswerAnalysis {
  wasMentioned: boolean;
  /** The client's position specifically. Null when mentioned with no list structure, or not mentioned at all. */
  position: number | null;
  /**
   * 100 / count of businesses this answer named, when the client was one of
   * them; 0 when the answer named others but not the client; null when the
   * answer named no business at all, which measures nothing about the client.
   */
  shareOfVoice: number | null;
  mentions: Mention[];
}

export interface EngineRun {
  engine: AiEngine;
  wasMentioned: boolean;
  position: number | null;
}

export interface AiVisibilityResult {
  /** 0-100 pillar sub-score. Null when there is no completed run yet to measure. */
  score: number | null;
  mentionRate: number | null;
  runsConsidered: number;
}
