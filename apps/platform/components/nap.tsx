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

/**
 * Score with its movement since the previous audit.
 *
 * A hero number rather than a chart, deliberately. Most clients will have one
 * or two audits, and a line drawn through a single point reads as a trend that
 * does not exist. The number is the headline; the sparkline below only appears
 * once there is genuinely a shape to see.
 */
export function ScoreHero({
  score,
  previous,
  asOf,
}: {
  score: number | null;
  previous: number | null;
  asOf: string | null;
}) {
  const delta = score !== null && previous !== null ? Math.round(score - previous) : null;

  return (
    <div className="card p-8">
      <div className="text-sm text-muted">Listing consistency</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-5xl font-semibold tabular-nums tracking-tight">
          {score === null ? '—' : score}
        </span>
        {score !== null && <span className="text-xl text-muted">/ 100</span>}

        {delta !== null && delta !== 0 && (
          // Direction is stated in words as well as colour and arrow, so the
          // meaning does not rest on colour alone.
          <span className={`pill ${delta > 0 ? 'bg-brand-wash text-brand-deep' : 'bg-accent/10 text-accent-deep'}`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)} {delta > 0 ? 'better' : 'lower'} than last check
          </span>
        )}
      </div>
      <p className="hint mt-3 max-w-lg">
        {score === null
          ? 'We could not confidently match your listings on any directory this time. Nothing here counts against you — see the detail below.'
          : 'How closely your name, address and phone match across the directories we could read. Directories we could not reach are reported separately and never lower this number.'}
      </p>
      {asOf && (
        <p className="text-xs text-muted mt-2">
          Last checked {new Date(asOf).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

/**
 * Single-series sparkline. Rendered only with 3+ points — see ScoreHero.
 *
 * One series, so no legend: the heading names it. The final value is labelled
 * directly rather than putting a number on every point, and the same data is
 * repeated as a table underneath so the shape is never the only way to read it.
 */
export function ScoreSparkline({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 3) return null;

  const w = 480;
  const h = 96;
  const pad = 10;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const span = max - min || 1;

  const x = (i: number) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.value)}`).join(' ');
  const last = points[points.length - 1]!;

  return (
    <figure className="card p-6">
      <figcaption className="text-sm font-medium">Consistency over time</figcaption>
      <p className="hint mb-4">One point per check.</p>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-24 overflow-visible"
        role="img"
        aria-label={`Listing consistency over ${points.length} checks, currently ${last.value} out of 100`}
      >
        <path d={path} fill="none" stroke="rgb(var(--brand))" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3.5}
                  fill="rgb(var(--brand))" stroke="rgb(var(--surface))" strokeWidth={2}>
            <title>{`${new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${p.value}`}</title>
          </circle>
        ))}
        {/* Only the current value is labelled — a number on every point is noise. */}
        <text x={x(points.length - 1)} y={y(last.value) - 12} textAnchor="end"
              className="fill-ink text-[11px] font-medium">
          {last.value}
        </text>
      </svg>

      <table className="w-full mt-4 text-sm">
        <caption className="sr-only">Listing consistency score by check date</caption>
        <thead>
          <tr>
            <th className="th !py-2">Checked</th>
            <th className="th !py-2 text-right">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {points.map((p) => (
            <tr key={p.date}>
              <td className="td !py-2">
                {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              <td className="td !py-2 text-right tabular-nums">{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
