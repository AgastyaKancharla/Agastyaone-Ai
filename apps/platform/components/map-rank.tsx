/** Shared presentation for geo-grid map rank, used by the Console and the Portal. */

export type HeatPoint = {
  idx: number;
  row_n: number;
  col_n: number;
  status: string;
  rank: number | null;
};

/**
 * Colour and label for one grid cell.
 *
 * The rank is always printed in the cell as well as encoded in the fill, so the
 * grid is readable without relying on colour — which matters for the roughly
 * 1 in 12 men with a colour vision deficiency, and for a printed report.
 */
function cellStyle(point: HeatPoint): { fill: string; label: string; text: string } {
  if (point.status === 'found' && point.rank !== null) {
    const r = point.rank;
    if (r <= 3) return { fill: `rgb(var(--brand) / ${1 - (r - 1) * 0.12})`, label: String(r), text: 'rgb(var(--surface))' };
    if (r <= 10) return { fill: `rgb(var(--accent) / ${0.75 - (r - 4) * 0.06})`, label: String(r), text: 'rgb(var(--ink))' };
    return { fill: `rgb(var(--danger) / ${0.45 - (r - 11) * 0.02})`, label: String(r), text: 'rgb(var(--ink))' };
  }
  if (point.status === 'not_ranked') {
    return { fill: 'rgb(var(--danger) / 0.85)', label: '·', text: 'rgb(var(--surface))' };
  }
  // Blocked, errored or ambiguous: we could not look, or could not be sure.
  // Deliberately neutral so it never reads as a bad ranking.
  return { fill: 'rgb(var(--hairline))', label: '?', text: 'rgb(var(--muted))' };
}

const STATUS_WORDS: Record<string, string> = {
  found: 'ranked',
  not_ranked: 'not in the top 20',
  ambiguous: 'a listing was found but could not be confirmed as yours',
  blocked: 'could not be checked — rate limited',
  error: 'could not be checked — error',
};

export function RankHeatmap({
  points,
  size,
  spacingM,
  keyword,
}: {
  points: HeatPoint[];
  size: number;
  spacingM: number;
  keyword: string;
}) {
  if (points.length === 0) return null;

  const cell = 46;
  const gap = 3;
  const dim = size * cell + (size - 1) * gap;
  const spanKm = ((size - 1) * spacingM) / 1000;

  const byIdx = new Map(points.map((p) => [p.idx, p]));

  return (
    <div>
      <svg
        viewBox={`0 0 ${dim} ${dim}`}
        className="w-full max-w-md"
        role="img"
        aria-label={`Google Maps ranking for "${keyword}" across a ${size} by ${size} grid covering ${spanKm} kilometres. The full results are in the table below.`}
      >
        {Array.from({ length: size * size }, (_, idx) => {
          const point = byIdx.get(idx);
          const row = Math.floor(idx / size);
          const col = idx % size;
          const x = col * (cell + gap);
          const y = row * (cell + gap);

          if (!point) {
            return <rect key={idx} x={x} y={y} width={cell} height={cell} rx="6" fill="rgb(var(--hairline))" opacity="0.4" />;
          }

          const { fill, label, text } = cellStyle(point);
          return (
            <g key={idx}>
              <title>
                {`${spacingM * (col - (size - 1) / 2)}m east, ${spacingM * ((size - 1) / 2 - row)}m north — ${
                  STATUS_WORDS[point.status] ?? point.status
                }${point.rank !== null ? ` at position ${point.rank}` : ''}`}
              </title>
              <rect x={x} y={y} width={cell} height={cell} rx="6" fill={fill} />
              <text
                x={x + cell / 2}
                y={y + cell / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="17"
                fontWeight="600"
                fill={text}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="hint mt-3">
        Each square is a point {spacingM} m apart, {spanKm} km across in total, and shows where you rank
        for &ldquo;{keyword}&rdquo; when someone searches from there. A dot means you did not appear at
        all; a question mark means that point could not be checked and is excluded from the score.
      </p>
    </div>
  );
}

/** The same data as a table, so the grid is never the only way to read it. */
export function HeatmapTable({ points, size }: { points: HeatPoint[]; size: number }) {
  const ranked = points.filter((p) => p.status === 'found' && p.rank !== null);
  const counts = {
    pack: ranked.filter((p) => (p.rank ?? 99) <= 3).length,
    top10: ranked.filter((p) => (p.rank ?? 99) > 3 && (p.rank ?? 99) <= 10).length,
    deep: ranked.filter((p) => (p.rank ?? 99) > 10).length,
    absent: points.filter((p) => p.status === 'not_ranked').length,
    unchecked: points.filter((p) => !['found', 'not_ranked'].includes(p.status)).length,
  };

  return (
    <table className="w-full mt-4">
      <thead className="bg-brand-wash border-b border-hairline">
        <tr>
          <th className="th">Where you appear</th>
          <th className="th">Points</th>
          <th className="th">Share of grid</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline">
        {[
          ['In the top 3 (the map pack)', counts.pack],
          ['Positions 4–10', counts.top10],
          ['Positions 11–20', counts.deep],
          ['Not in the top 20', counts.absent],
          ['Could not be checked', counts.unchecked],
        ].map(([label, count]) => (
          <tr key={label as string}>
            <td className="td">{label}</td>
            <td className="td tabular-nums">{count}</td>
            <td className="td tabular-nums">
              {size * size === 0 ? '—' : `${Math.round((100 * (count as number)) / (size * size))}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ScanMetrics({
  score,
  solv,
  arp,
  coverage,
}: {
  score: number | null;
  solv: number | null;
  arp: number | null;
  coverage: number | null;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {score ?? '—'}
          {score !== null && <span className="text-lg text-muted">/100</span>}
        </div>
        <div className="text-sm text-muted mt-1">Map rank score</div>
        <p className="hint">Weighted towards the top 3, where the calls come from.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {solv ?? '—'}
          {solv !== null && <span className="text-lg text-muted">%</span>}
        </div>
        <div className="text-sm text-muted mt-1">Share of local voice</div>
        <p className="hint">Share of the area where you make the map pack.</p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">{arp ?? '—'}</div>
        <div className="text-sm text-muted mt-1">Average position</div>
        <p className="hint">
          {arp === null ? 'You did not appear anywhere on this grid.' : 'Counted only where you appear at all.'}
        </p>
      </div>
      <div className="card p-5">
        <div className="text-3xl font-semibold tabular-nums">
          {coverage ?? '—'}
          {coverage !== null && <span className="text-lg text-muted">%</span>}
        </div>
        <div className="text-sm text-muted mt-1">Coverage</div>
        <p className="hint">Below 80% the scan is kept but not charted.</p>
      </div>
    </div>
  );
}
