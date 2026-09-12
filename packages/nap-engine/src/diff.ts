import type {
  Candidate,
  DirectoryResult,
  DirectoryStatus,
  FieldDiff,
  MatchStatus,
  SourceOfTruth,
} from './types.ts';
import {
  normalizeAddress,
  normalizeName,
  normalizePhone,
  normalizeWebsite,
  similarity,
  tokenOverlap,
} from './normalize.ts';
import { DEFAULT_THRESHOLDS, selectMatch, type MatchThresholds } from './matcher.ts';

/** Per-field bands, injectable so a tier or vertical can be stricter. */
export interface DiffConfig {
  nameExact: number;
  nameDrift: number;
  addressExact: number;
  addressDrift: number;
  /** Contribution to overall confidence. Must sum to 1. */
  weights: { name: number; phone: number; address: number };
}

export const DEFAULT_DIFF_CONFIG: DiffConfig = {
  nameExact: 100,
  nameDrift: 75,
  addressExact: 90,
  addressDrift: 60,
  weights: { name: 0.35, phone: 0.35, address: 0.3 },
};

function diffName(source: SourceOfTruth, c: Candidate, cfg: DiffConfig): FieldDiff {
  const a = normalizeName(source.businessName);
  const b = normalizeName(c.name);
  if (!c.name) {
    return { field: 'business_name', sourceValue: source.businessName, foundValue: null,
             status: 'missing', similarity: 0, note: 'The listing shows no business name.' };
  }
  const score = Math.max(similarity(a, b), tokenOverlap(a, b));
  const status: MatchStatus =
    score >= cfg.nameExact ? 'exact' : score >= cfg.nameDrift ? 'drift' : 'mismatch';
  return {
    field: 'business_name',
    sourceValue: source.businessName,
    foundValue: c.name,
    status,
    similarity: score,
    note:
      status === 'exact' ? 'Matches.'
      : status === 'drift' ? 'Close, but not identical — worth aligning.'
      : 'Differs materially from your business name.',
  };
}

/**
 * Phone is the field the retired tool got most wrong.
 *
 * It collapsed "no phone shown" into the same bucket as "a different number is
 * shown", and scored both as zero on a 0.4 weight. Those need opposite actions:
 * one is "add your number", the other is "someone has published the wrong
 * number, fix it before you lose calls". They are separate statuses now, and
 * `missing` does not carry the same confidence penalty as `mismatch` — absent
 * information is not the same as wrong information.
 */
function diffPhone(source: SourceOfTruth, c: Candidate): FieldDiff {
  const src = source.phoneE164 ?? null;
  const found = normalizePhone(c.phone);

  if (!found) {
    return { field: 'phone', sourceValue: src, foundValue: null, status: 'missing', similarity: 0,
             note: 'No phone number on this listing — add it so callers can reach you.' };
  }
  if (!src) {
    return { field: 'phone', sourceValue: null, foundValue: found, status: 'missing', similarity: 0,
             note: 'No phone on file to compare against.' };
  }
  const same = src === found;
  return {
    field: 'phone',
    sourceValue: src,
    foundValue: found,
    status: same ? 'exact' : 'mismatch',
    similarity: same ? 100 : 0,
    note: same ? 'Matches.' : 'A different number is published here — calls may be going elsewhere.',
  };
}

function diffAddress(source: SourceOfTruth, c: Candidate, cfg: DiffConfig): FieldDiff {
  const srcRaw = [source.addressLine1, source.addressLine2, source.locality, source.city, source.pincode]
    .filter(Boolean).join(', ');
  const a = normalizeAddress(srcRaw);
  const b = normalizeAddress(c.address);

  if (!c.address) {
    return { field: 'address', sourceValue: srcRaw || null, foundValue: null, status: 'missing',
             similarity: 0, note: 'No address on this listing.' };
  }
  const score = Math.max(similarity(a, b), tokenOverlap(a, b));
  const status: MatchStatus =
    score >= cfg.addressExact ? 'exact' : score >= cfg.addressDrift ? 'drift' : 'mismatch';
  return {
    field: 'address',
    sourceValue: srcRaw || null,
    foundValue: c.address,
    status,
    similarity: score,
    note:
      status === 'exact' ? 'Matches.'
      : status === 'drift' ? 'Same place, written differently — inconsistent formatting hurts local ranking.'
      : 'A different address is published here.',
  };
}

function diffWebsite(source: SourceOfTruth, c: Candidate): FieldDiff | null {
  const a = normalizeWebsite(source.website);
  const b = normalizeWebsite(c.website);
  if (!a && !b) return null; // nothing to say

  if (!b) {
    return { field: 'website', sourceValue: source.website ?? null, foundValue: null,
             status: 'missing', similarity: 0, note: 'No website link on this listing.' };
  }
  if (!a) {
    return { field: 'website', sourceValue: null, foundValue: c.website ?? null,
             status: 'missing', similarity: 0, note: 'No website on file to compare against.' };
  }
  const same = a === b;
  return {
    field: 'website',
    sourceValue: source.website ?? null,
    foundValue: c.website ?? null,
    status: same ? 'exact' : 'mismatch',
    similarity: same ? 100 : 0,
    note: same ? 'Matches.' : 'Points at a different site.',
  };
}

/**
 * Overall verdict.
 *
 * Website is computed and reported but excluded from the verdict, because a
 * missing website link is not a NAP inconsistency — Name, Address and Phone are
 * what the acronym is about, and what search engines reconcile.
 */
function verdict(diffs: FieldDiff[]): DirectoryStatus {
  const by = (f: string) => diffs.find((d) => d.field === f)?.status;
  const name = by('business_name');
  const phone = by('phone');
  const address = by('address');

  const allExact = name === 'exact' && phone === 'exact' && address === 'exact';
  if (allExact) return 'consistent';

  const nameOk = name === 'exact' || name === 'drift';
  const addrOk = address === 'exact' || address === 'drift';
  // A merely-absent phone is drift, not inconsistency: nothing wrong is
  // published, something is simply not published yet.
  const phoneOk = phone === 'exact' || phone === 'missing';
  if (nameOk && addrOk && phoneOk) return 'drift';

  return 'inconsistent';
}

function confidence(diffs: FieldDiff[], cfg: DiffConfig): number {
  const score = (f: string) => diffs.find((d) => d.field === f)?.similarity ?? 0;
  const w = cfg.weights;
  return Math.round(
    score('business_name') * w.name + score('phone') * w.phone + score('address') * w.address,
  );
}

/** Diff one directory's candidates against the source of truth. */
export function evaluateDirectory(
  directoryCode: string,
  source: SourceOfTruth,
  candidates: Candidate[],
  opts: { thresholds?: MatchThresholds; diff?: DiffConfig } = {},
): DirectoryResult {
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const cfg = opts.diff ?? DEFAULT_DIFF_CONFIG;

  const base = {
    directoryCode,
    isClaimed: null,
    rating: null,
    reviewCount: null,
    errorMessage: null,
  };

  const outcome = selectMatch(source, candidates, thresholds);

  if (outcome.kind === 'not_found') {
    return {
      ...base, status: 'not_found', found: false, listingUrl: null,
      matchConfidence: outcome.best ? outcome.best.score : null,
      runnerUpMargin: null, overallConfidence: null, diffs: [],
    };
  }

  if (outcome.kind === 'ambiguous') {
    // Deliberately no diffs. Reporting field-level detail for a listing we
    // cannot confidently attribute is how a competitor's address reaches a
    // client's report.
    return {
      ...base, status: 'ambiguous', found: true,
      listingUrl: outcome.best.candidate.listingUrl ?? null,
      matchConfidence: outcome.best.score,
      runnerUpMargin: outcome.margin,
      overallConfidence: null,
      diffs: [],
    };
  }

  const c = outcome.best.candidate;
  const diffs = [
    diffName(source, c, cfg),
    diffPhone(source, c),
    diffAddress(source, c, cfg),
    diffWebsite(source, c),
  ].filter((d): d is FieldDiff => d !== null);

  return {
    ...base,
    status: verdict(diffs),
    found: true,
    listingUrl: c.listingUrl ?? null,
    matchConfidence: outcome.best.score,
    runnerUpMargin: outcome.margin,
    overallConfidence: confidence(diffs, cfg),
    isClaimed: c.isClaimed ?? null,
    rating: c.rating ?? null,
    reviewCount: c.reviewCount ?? null,
    diffs,
  };
}
