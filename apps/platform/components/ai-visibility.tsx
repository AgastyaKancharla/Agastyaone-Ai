/** Shared presentation for AI answer-engine visibility, used by the Console and the Portal. */

export const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  copilot: 'Copilot',
  other: 'Other',
};

// The four engines enqueue_geo_runs actually checks today. Kept separate from
// ENGINE_LABEL's keys, which also cover values the schema allows for the
// future ('copilot', 'other') but nothing enqueues yet.
export const ACTIVE_ENGINES = ['chatgpt', 'perplexity', 'gemini', 'claude'] as const;

export type EngineResult = {
  engine: string;
  status: string;
  wasMentioned: boolean;
  position: number | null;
  shareOfVoice: number | null;
  error: string | null;
};

/** One row: the engine's name plus what it last said about this prompt. */
export function EngineRow({ engine, result }: { engine: string; result: EngineResult | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm font-medium w-24 shrink-0">{ENGINE_LABEL[engine] ?? engine}</span>
      <div className="flex-1 flex items-center justify-end gap-3 flex-wrap">
        {!result && <span className="text-xs text-muted">never checked</span>}
        {result?.status === 'failed' && (
          <span className="text-xs text-muted">{result.error ?? 'could not be checked'}</span>
        )}
        {result && result.status !== 'failed' && result.status !== 'completed' && (
          <span className="text-xs text-muted">queued</span>
        )}
        {result?.status === 'completed' && (
          <>
            {result.wasMentioned ? (
              <span className="pill bg-brand-wash text-brand-deep">
                mentioned{result.position ? ` at #${result.position}` : ''}
              </span>
            ) : (
              <span className="pill bg-hairline text-muted">not mentioned</span>
            )}
            {result.shareOfVoice !== null && (
              <span className="text-xs text-muted tabular-nums">{result.shareOfVoice}% share of voice</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Plain mention-rate arithmetic for display only — NOT the weighted 0-100
 * pillar score. That score is computed once, in
 * packages/ai-visibility-engine, and shown on the Visibility page; repeating
 * its weighting here would give the two pages two different numbers for
 * "how visible are we in AI answers".
 */
export function MentionRateTiles({
  mentioned,
  total,
}: {
  mentioned: number;
  total: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {total === 0 ? '—' : `${Math.round((100 * mentioned) / total)}%`}
        </div>
        <div className="text-sm text-muted mt-1">Mention rate</div>
        <p className="hint">Share of checks, across every prompt and engine, that named you at all.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">{total}</div>
        <div className="text-sm text-muted mt-1">Checks considered</div>
        <p className="hint">Latest completed run per prompt and engine.</p>
      </div>
    </div>
  );
}
