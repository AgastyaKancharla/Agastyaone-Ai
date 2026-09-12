import {
  PILLAR_WEIGHTS,
  PILLARS,
  type CompositeResult,
  type PillarInput,
  type ScoredPillar,
} from './types.ts';

const TOTAL_WEIGHT = Object.values(PILLAR_WEIGHTS).reduce((a, b) => a + b, 0);

/**
 * Weighted mean over the pillars that were actually measured, with the
 * remaining weights re-normalised over them.
 *
 * This is the whole reason the product can ship with three pillars live and
 * still tell the truth. The naive alternative -- scoring unmeasured pillars as
 * zero -- would put every client near 40/100 today and then float them upward
 * as we add pillars, producing a rising chart that reflects our roadmap rather
 * than their business. Re-normalising instead means the score answers "of what
 * we could see, how visible are you", and `coveragePct` separately answers
 * "how much could we see".
 *
 * Same discipline as `summarize()` in nap-engine, which excludes errored
 * directories from auditScore and reports coveragePct beside it.
 */
export function compositeScore(inputs: PillarInput[]): CompositeResult {
  const byPillar = new Map(inputs.map((p) => [p.pillar, p]));

  const pillars: ScoredPillar[] = PILLARS.map((pillar) => {
    const input = byPillar.get(pillar);
    const score = input?.score ?? null;
    return {
      pillar,
      score,
      weight: PILLAR_WEIGHTS[pillar],
      measured: score !== null,
      detail: input?.detail ?? null,
    };
  });

  const measured = pillars.filter((p) => p.measured);
  const measuredWeight = measured.reduce((sum, p) => sum + p.weight, 0);

  if (measuredWeight === 0) {
    return { score: null, coveragePct: 0, pillars };
  }

  const weighted = measured.reduce((sum, p) => sum + (p.score as number) * p.weight, 0);

  return {
    score: round2(weighted / measuredWeight),
    coveragePct: round2((measuredWeight / TOTAL_WEIGHT) * 100),
    pillars,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
