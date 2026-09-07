/**
 * NAP audit domain types.
 *
 * Written fresh rather than ported. The retired tool's types encoded three
 * mistakes that are corrected here, each of which produced a wrong answer for a
 * client rather than a crash:
 *
 *  1. There was no `found` flag. "Was this listing found" was inferred from
 *     whether `listingUrl` was set — and the adapters set it to the SEARCH url,
 *     so every result read as found.
 *  2. There was no way to say "I found something but I am not confident it is
 *     this business", so the first search hit was diffed as gospel. A
 *     competitor's listing could be reported to a client as their own NAP error.
 *  3. `MISSING` and `MISMATCH` were collapsed for phone, so "your number is
 *     absent" and "someone else's number is published" looked identical,
 *     despite needing opposite actions from the client.
 */

export type FieldName = 'business_name' | 'address' | 'phone' | 'website' | 'category';

/** Per-field verdict. `missing` and `mismatch` are deliberately distinct. */
export type MatchStatus = 'exact' | 'drift' | 'mismatch' | 'missing';

/**
 * Per-directory verdict.
 *
 * `ambiguous` is the important addition: a candidate was found but did not
 * clearly identify as this business, so it is held for human review instead of
 * being shown to the client as fact.
 */
export type DirectoryStatus =
  | 'consistent'
  | 'drift'
  | 'inconsistent'
  | 'not_found'
  | 'ambiguous'
  | 'error';

export interface SourceOfTruth {
  businessName: string;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  locality?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  /** E.164, e.g. +919876543210. */
  phoneE164?: string | undefined;
  website?: string | undefined;
  category?: string | undefined;
}

/** One candidate scraped off a directory's search results. */
export interface Candidate {
  /** The listing's own URL. Never a search URL. */
  listingUrl?: string | undefined;
  name?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  website?: string | undefined;
  category?: string | undefined;
  rating?: number | undefined;
  reviewCount?: number | undefined;
  isClaimed?: boolean | undefined;
  raw?: Record<string, unknown> | undefined;
}

export interface FieldDiff {
  field: FieldName;
  sourceValue: string | null;
  foundValue: string | null;
  status: MatchStatus;
  similarity: number;
  note: string;
}

export interface DirectoryResult {
  directoryCode: string;
  status: DirectoryStatus;
  found: boolean;
  listingUrl: string | null;
  /** How sure we are this listing IS the business (0-100). */
  matchConfidence: number | null;
  /** How far the best candidate beat the runner-up. Low = ambiguous. */
  runnerUpMargin: number | null;
  /** How well the matched listing agrees with the source of truth (0-100). */
  overallConfidence: number | null;
  isClaimed: boolean | null;
  rating: number | null;
  reviewCount: number | null;
  diffs: FieldDiff[];
  errorMessage: string | null;
}

export interface AuditSummary {
  directoriesRequested: number;
  /** Excludes errored directories. */
  directoriesChecked: number;
  directoriesErrored: number;
  consistentCount: number;
  driftCount: number;
  inconsistentCount: number;
  notFoundCount: number;
  ambiguousCount: number;
  /**
   * Mean overall confidence across CHECKED directories only.
   *
   * The retired tool averaged over every directory including errors scoring
   * zero, so a blocked scraper silently dragged a perfect client from 100 to
   * 60. Coverage is reported separately instead, which is the honest split:
   * "how healthy are the listings we could read" and "how many could we read".
   */
  auditScore: number | null;
  coveragePct: number;
}
