/** Shared presentation for the backlinks pillar, used by the Console and the Portal. */

export function BacklinksSummaryTiles({
  score,
  referringDomains,
  totalBacklinks,
  brokenBacklinks,
  spamScore,
}: {
  score: number | null;
  referringDomains: number | null;
  totalBacklinks: number | null;
  brokenBacklinks: number | null;
  spamScore: number | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {score ?? '—'}
          {score !== null && <span className="text-lg text-muted">/100</span>}
        </div>
        <div className="text-sm text-muted mt-1">Backlinks score</div>
        <p className="hint">Log-scaled toward what a single-location practice can realistically build.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">{referringDomains ?? '—'}</div>
        <div className="text-sm text-muted mt-1">Referring domains</div>
        <p className="hint">Distinct sites linking to you. The number that actually drives the score.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">{totalBacklinks ?? '—'}</div>
        <div className="text-sm text-muted mt-1">Total backlinks</div>
        <p className="hint">Every link counted, including several from the same domain.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {spamScore ?? '—'}
          {spamScore !== null && <span className="text-lg text-muted">/100</span>}
        </div>
        <div className="text-sm text-muted mt-1">Spam score</div>
        <p className="hint">
          {spamScore !== null && spamScore > 30
            ? 'Above 30 is worth a look — consider disavowing the worst offenders.'
            : 'Under 30 is unremarkable for any real site.'}
        </p>
      </div>
      {brokenBacklinks !== null && brokenBacklinks > 0 && (
        <div className="card p-5 sm:col-span-2 lg:col-span-4">
          <p className="text-sm">
            <span className="font-medium">{brokenBacklinks}</span> backlink
            {brokenBacklinks === 1 ? ' points' : 's point'} to a page that no longer exists. Worth asking
            the referring site to update it, or redirecting the old page if it moved.
          </p>
        </div>
      )}
    </div>
  );
}
