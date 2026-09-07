/** Shared presentation for audit results, used by both the location page and the audit detail. */

export function AuditStatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    consistent:   'bg-brand-wash text-brand-deep',
    drift:        'bg-accent/10 text-accent-deep',
    inconsistent: 'bg-danger/10 text-danger',
    not_found:    'bg-hairline text-muted',
    ambiguous:    'bg-accent/10 text-accent-deep',
    error:        'bg-hairline text-muted',
    queued:       'bg-hairline text-muted',
    running:      'bg-brand-wash text-brand-deep',
    completed:    'bg-brand-wash text-brand-deep',
    failed:       'bg-danger/10 text-danger',
  };
  return <span className={`pill ${tone[status] ?? 'bg-hairline text-muted'}`}>{status.replace('_', ' ')}</span>;
}

/**
 * What each verdict means in plain language, so the Console says the same thing
 * the client will eventually be told.
 */
export const STATUS_MEANING: Record<string, string> = {
  consistent:   'Name, address and phone all match.',
  drift:        'Same business, written differently — inconsistent formatting weakens local ranking.',
  inconsistent: 'Something material differs. Worth fixing first.',
  not_found:    'No listing we could confidently attribute to this business.',
  ambiguous:    'A listing was found but could not be confidently attributed — held for review rather than reported.',
  error:        'The directory could not be read. Excluded from the score; shown as reduced coverage.',
};

export function ScoreCard({
  score,
  coverage,
  errored,
}: {
  score: number | null;
  coverage: number | null;
  errored: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {score === null ? '—' : score}
          {score !== null && <span className="text-lg text-muted">/100</span>}
        </div>
        <div className="text-sm text-muted mt-1">Consistency score</div>
        <p className="hint">
          {score === null
            ? 'No listing could be confidently attributed yet.'
            : 'Across directories we could read. A blocked scraper never lowers this.'}
        </p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">{coverage ?? '—'}<span className="text-lg text-muted">%</span></div>
        <div className="text-sm text-muted mt-1">Coverage</div>
        <p className="hint">Share of directories successfully checked.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">{errored}</div>
        <div className="text-sm text-muted mt-1">Unreadable</div>
        <p className="hint">Reported separately, never folded into the score.</p>
      </div>
    </div>
  );
}
