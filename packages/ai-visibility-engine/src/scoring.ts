import type { AiVisibilityResult, EngineRun } from './types.ts';

/**
 * Top-heavy by position, same principle as map-rank's visibilityWeight: being
 * the first business an answer engine names is worth far more than being
 * fourth in the same list, because most patients act on the first one or two
 * names an assistant gives them and stop reading.
 *
 * A mention with no list position (prose, not a ranked list) is scored as a
 * flat mid-weight: real credit for being named at all, without pretending to
 * know whether prose placement means "first choice" or "in passing".
 */
const POSITION_WEIGHT: Record<number, number> = { 1: 1.0, 2: 0.8, 3: 0.6, 4: 0.4 };
const PROSE_MENTION_WEIGHT = 0.5;

function runWeight(run: EngineRun): number {
  if (!run.wasMentioned) return 0;
  if (run.position === null) return PROSE_MENTION_WEIGHT;
  return POSITION_WEIGHT[run.position] ?? Math.max(0, 0.3 - (run.position - 5) * 0.05);
}

/**
 * @param runs The most recent COMPLETED run per (prompt, engine) combination —
 *   the caller de-duplicates to that before calling in, the same way the
 *   worker takes only the latest completed NAP audit for the citations pillar.
 *   An empty array means nothing has completed yet, not that the clinic
 *   scored zero, so the result is null rather than 0 — the rule that runs
 *   through every pillar in this product.
 */
export function computeAiVisibilityScore(runs: EngineRun[]): AiVisibilityResult {
  if (runs.length === 0) {
    return { score: null, mentionRate: null, runsConsidered: 0 };
  }

  const mentioned = runs.filter((r) => r.wasMentioned).length;

  return {
    score: Math.round(100 * mean(runs.map(runWeight))),
    mentionRate: round1((100 * mentioned) / runs.length),
    runsConsidered: runs.length,
  };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
