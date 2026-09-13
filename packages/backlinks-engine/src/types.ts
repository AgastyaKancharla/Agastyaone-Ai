/**
 * A snapshot of one domain's off-site link profile, as a provider's summary
 * endpoint reports it -- never the raw backlink list, which this product has
 * no use for. A clinic owner needs "is anyone linking to me, and does it look
 * healthy", not a spreadsheet of URLs.
 */
export interface BacklinksSummary {
  referringDomains: number;
  totalBacklinks: number;
  brokenBacklinks: number;
  /** Provider's own 0-100 average spam score across referring domains. Higher is worse. Null when the provider does not report one. */
  spamScore: number | null;
  /**
   * The provider's own proprietary authority-like rank (DataForSEO: 0-1000).
   * Carried through for display only -- never scored on. Building a
   * client-facing score around one vendor's unvalidated scale would be the
   * same mistake PageSpeed's raw Lighthouse score is deliberately not: a
   * number the client cannot sanity-check that would silently change meaning
   * if the vendor changes.
   */
  domainRank: number | null;
}

/**
 * Discriminated on purpose, the same shape as PointOutcome and AnswerOutcome:
 * a caller cannot reach `summary` without narrowing first, so a rate-limited
 * or errored check can never be silently read as "zero backlinks".
 */
export type SummaryOutcome =
  | { status: 'ok'; summary: BacklinksSummary; fetchedAt: string }
  | { status: 'blocked'; reason: string }
  | { status: 'error'; reason: string };

export interface BacklinksProvider {
  readonly code: 'dataforseo_backlinks' | 'fixture_backlinks';
  readonly costMicrosPerCheck: number;
  collect(domain: string, signal?: AbortSignal): Promise<SummaryOutcome>;
}

export interface BacklinksResult {
  /** 0-100 pillar sub-score. Null when there is no completed check yet to measure. */
  score: number | null;
  referringDomains: number | null;
  totalBacklinks: number | null;
  spamScore: number | null;
}
