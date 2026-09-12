/** Shared presentation for the Digital Visibility score, used by the Console and the Portal. */

export const PILLAR_LABEL: Record<string, string> = {
  map_rank: 'Map rank',
  website: 'Website',
  citations: 'Listings',
  reviews: 'Reviews',
  ai_visibility: 'AI answer engines',
  backlinks: 'Backlinks',
};

/** What each pillar actually measures, in the words a client would use. */
export const PILLAR_MEANING: Record<string, string> = {
  map_rank: 'Where you appear on Google Maps across the area around the clinic.',
  website: 'How findable your own site is — to Google, and to AI assistants deciding what to cite.',
  citations: 'Whether your name, address and phone match across Indian directories.',
  reviews: 'How well the review programme is converting — what share of issued codes get scanned.',
  ai_visibility: 'Whether ChatGPT, Perplexity and Gemini mention you when asked for a clinic.',
  backlinks: 'How many other sites link to yours, and how much authority they carry.',
};

export const SIGNAL_GROUP_LABEL: Record<string, string> = {
  seo: 'Search engines',
  geo: 'AI answer engines',
  aeo: 'Direct answers & voice',
};

export function VisibilityScoreHero({
  score,
  coverage,
  measured,
  asOf,
}: {
  score: number | null;
  coverage: number | null;
  measured: number;
  asOf: string | null;
}) {
  return (
    <div className="card p-8">
      <div className="text-sm text-muted">Digital visibility</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-5xl font-semibold tabular-nums tracking-tight">
          {score === null ? '—' : score}
        </span>
        {score !== null && <span className="text-xl text-muted">/ 100</span>}
        <span className="pill bg-hairline text-muted">{measured} of 6 measured</span>
      </div>
      <p className="hint mt-3 max-w-lg">
        {score === null
          ? 'Nothing could be measured on this run. That is not a score of zero — see the pillars below for what was missing.'
          : 'Scored across the pillars we could measure. Anything unmeasured is left out of the average entirely rather than counted as a failure, so an unreachable source never drags this down.'}
      </p>
      {coverage !== null && (
        <p className="text-xs text-muted mt-2">
          Coverage {coverage}% — the share of the full model measured this run.
        </p>
      )}
      {asOf && (
        <p className="text-xs text-muted mt-1">
          Last checked{' '}
          {new Date(asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

/**
 * One bar per pillar.
 *
 * Hand-rolled rather than charted: the repo carries no charting library, and a
 * bar whose value is printed beside it needs no legend and no alt text — the
 * number is already the text.
 */
export function PillarBars({
  pillars,
}: {
  pillars: { pillar: string; score: number | null; weight: number; measured: boolean }[];
}) {
  return (
    <div className="divide-y divide-hairline">
      {pillars.map((p) => (
        <div key={p.pillar} className="px-6 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium">{PILLAR_LABEL[p.pillar] ?? p.pillar}</span>
            <span className="text-sm tabular-nums shrink-0">
              {p.measured ? (
                <>
                  {p.score}
                  <span className="text-muted">/100</span>
                </>
              ) : (
                <span className="text-muted">not measured yet</span>
              )}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-hairline overflow-hidden">
            {p.measured && (
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(100, p.score ?? 0))}%`,
                  // Token-based so the fill survives dark mode, matching ScoreSparkline.
                  background: 'rgb(var(--brand))',
                }}
              />
            )}
          </div>
          <p className="hint mt-1.5">
            {PILLAR_MEANING[p.pillar]}
            {' '}
            <span className="text-muted">Worth {p.weight}% of the full score.</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function FindingKindPill({ kind }: { kind: string }) {
  const tone: Record<string, string> = {
    issue: 'bg-danger/10 text-danger',
    opportunity: 'bg-accent/10 text-accent-deep',
    passed: 'bg-brand-wash text-brand-deep',
  };
  return <span className={`pill ${tone[kind] ?? 'bg-hairline text-muted'}`}>{kind}</span>;
}
