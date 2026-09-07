import type { Candidate, SourceOfTruth } from './types.ts';
import {
  normalizeAddress,
  normalizeName,
  normalizePhone,
  normalizeWebsite,
  similarity,
  tokenOverlap,
} from './normalize.ts';

/**
 * Identity verification — deciding whether a candidate IS this business, which
 * is a different question from whether its details agree.
 *
 * The retired tool never asked it: it took `.first()` off the search results
 * and diffed it. On a search for "Nissa Dental Koramangala" that can easily be
 * a competitor, and the client is then shown someone else's address as their
 * own NAP error. That is worse than reporting nothing, because it destroys
 * trust in every other number on the page.
 */

export interface MatchThresholds {
  /** Below this, no candidate is convincing enough to diff at all. */
  accept: number;
  /** The winner must beat the runner-up by at least this, or it is ambiguous. */
  margin: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = { accept: 70, margin: 15 };

/**
 * Identity rests on NAME and ADDRESS, with phone as an adjustment rather than a
 * gate.
 *
 * Phone is the strongest single confirmation — two clinics do not share a
 * landline — but it cannot be allowed to veto a match, because "this listing
 * publishes the wrong number" is the most valuable finding a NAP audit
 * produces. An early version of this scorer weighted phone at 50% of identity,
 * and the consequence was that any listing with a wrong number scored too low
 * to be matched at all, so the finding was silently dropped instead of
 * reported.
 *
 * So: name and address establish who this is; a matching phone confirms it; a
 * conflicting phone dents confidence without erasing the match.
 */
const W = { name: 60, address: 25, website: 15 } as const;
const PHONE_CONFIRM = 20;
const PHONE_CONFLICT = 15;

export interface ScoredCandidate {
  candidate: Candidate;
  score: number;
  signals: Record<string, number>;
}

export function scoreCandidate(source: SourceOfTruth, candidate: Candidate): ScoredCandidate {
  const signals: Record<string, number> = {};
  let earned = 0;
  let available = 0;

  // Name — the better of edit distance and token overlap, so word reordering
  // ("Koramangala Nissa Dental" vs "Nissa Dental Koramangala") is not punished.
  const srcName = normalizeName(source.businessName);
  const candName = normalizeName(candidate.name);
  if (srcName && candName) {
    available += W.name;
    const best = Math.max(similarity(srcName, candName), tokenOverlap(srcName, candName));
    const hit = (best / 100) * W.name;
    earned += hit;
    signals.name = Math.round(hit * 100) / 100;
  }

  // Address. Weighted modestly: a stale address is precisely the drift being
  // audited, so demanding it match would reject the listings worth reporting.
  const srcAddr = normalizeAddress(
    [source.addressLine1, source.locality, source.city].filter(Boolean).join(' '),
  );
  const candAddr = normalizeAddress(candidate.address);
  if (srcAddr && candAddr) {
    available += W.address;
    const best = Math.max(similarity(srcAddr, candAddr), tokenOverlap(srcAddr, candAddr));
    const hit = (best / 100) * W.address;
    earned += hit;
    signals.address = Math.round(hit * 100) / 100;
  }

  // Website
  const srcSite = normalizeWebsite(source.website);
  const candSite = normalizeWebsite(candidate.website);
  if (srcSite && candSite) {
    available += W.website;
    const hit = srcSite === candSite ? W.website : 0;
    earned += hit;
    signals.website = hit;
  }

  // Scored out of the evidence that was actually comparable. A field either
  // side omits is excluded from the denominator rather than counted as a miss.
  let score = available === 0 ? 0 : (earned / available) * 100;

  // Phone adjustment, applied after the base so it shifts confidence rather
  // than dominating it.
  const srcPhone = source.phoneE164 ?? null;
  const candPhone = normalizePhone(candidate.phone);
  if (srcPhone && candPhone) {
    if (candPhone === srcPhone) {
      score = Math.min(100, score + PHONE_CONFIRM);
      signals.phone = PHONE_CONFIRM;
    } else {
      score = Math.max(0, score - PHONE_CONFLICT);
      signals.phone = -PHONE_CONFLICT;
    }
  }

  return { candidate, score: Math.round(score * 100) / 100, signals };
}

export type MatchOutcome =
  | { kind: 'matched'; best: ScoredCandidate; margin: number | null }
  | { kind: 'ambiguous'; best: ScoredCandidate; margin: number; runnerUp: ScoredCandidate }
  | { kind: 'not_found'; best: ScoredCandidate | null };

/**
 * Picks the listing to diff, or refuses to pick one.
 *
 * Two independent gates. A candidate must be convincing on its own AND clearly
 * better than the next one. One alone is not enough: two near-identical
 * clinics both scoring 85 means we cannot tell them apart, and guessing is how
 * a competitor's listing ends up in a client's report.
 */
export function selectMatch(
  source: SourceOfTruth,
  candidates: Candidate[],
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): MatchOutcome {
  if (candidates.length === 0) return { kind: 'not_found', best: null };

  const scored = candidates
    .map((c) => scoreCandidate(source, c))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  if (best.score < thresholds.accept) return { kind: 'not_found', best };

  const runnerUp = scored[1];
  if (!runnerUp) return { kind: 'matched', best, margin: null };

  const margin = Math.round((best.score - runnerUp.score) * 100) / 100;
  if (margin < thresholds.margin) return { kind: 'ambiguous', best, margin, runnerUp };

  return { kind: 'matched', best, margin };
}
