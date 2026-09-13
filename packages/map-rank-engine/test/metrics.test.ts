import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeGridMetrics, shouldSnapshot, visibilityWeight } from '../src/metrics.ts';
import type { PointRank } from '../src/types.ts';

const DEPTH = 20;

test('a clinic ranking first everywhere scores 100', () => {
  const m = computeGridMetrics(Array<PointRank>(81).fill(1), DEPTH, 81);
  assert.equal(m.arp, 1);
  assert.equal(m.atrp, 1);
  assert.equal(m.solv, 100);
  assert.equal(m.score, 100);
  assert.equal(m.coveragePct, 100);
});

test('found nowhere is a real zero, with a null ARP rather than a fake rank', () => {
  const m = computeGridMetrics(Array<PointRank>(81).fill('not_ranked'), DEPTH, 81);
  assert.equal(m.arp, null, 'ARP must be null, never 0 and never depth');
  assert.equal(m.atrp, 21, 'ATRP uses the depth+1 penalty');
  assert.equal(m.solv, 0);
  assert.equal(m.score, 0, 'genuinely invisible IS a zero');
  assert.equal(m.pointsFound, 0);
});

test('nothing scanned returns a null score, which is not the same as zero', () => {
  const m = computeGridMetrics([], DEPTH, 81);
  assert.equal(m.score, null, 'could not assess');
  assert.equal(m.arp, null);
  assert.equal(m.pointsScanned, 0);
  assert.equal(m.pointsExcluded, 81);
  assert.equal(m.coveragePct, 0);
});

test('ARP counts only where found; ATRP counts everywhere', () => {
  // Ranks 2 and 4 where found, invisible at the other two points.
  const m = computeGridMetrics([2, 4, 'not_ranked', 'not_ranked'], DEPTH, 4);
  assert.equal(m.arp, 3, 'mean of 2 and 4');
  assert.equal(m.atrp, 12, 'mean of 2, 4, 21, 21');
  assert.equal(m.pointsFound, 2);
});

test('SoLV is the share of scanned points in the local pack', () => {
  const ranks: PointRank[] = [1, 2, 3, 4, 5, 'not_ranked', 'not_ranked', 'not_ranked'];
  const m = computeGridMetrics(ranks, DEPTH, 8);
  assert.equal(m.solv, 37.5, '3 of 8 points rank 1-3');
});

test('excluded points are removed from every denominator, not scored as failures', () => {
  // Same six good points; the second scan additionally lost two to blocking.
  const clean = computeGridMetrics([1, 1, 1, 1, 1, 1], DEPTH, 6);
  const blocked = computeGridMetrics([1, 1, 1, 1, 1, 1], DEPTH, 8);

  assert.equal(clean.score, blocked.score, 'blocking must not move the score');
  assert.equal(clean.solv, blocked.solv);
  assert.equal(clean.arp, blocked.arp);
  assert.equal(blocked.coveragePct, 75, 'it shows up as coverage instead');
  assert.equal(blocked.pointsExcluded, 2);
});

test('a scan that lost too many points writes no trend point at all', () => {
  const good = computeGridMetrics(Array<PointRank>(70).fill(3), DEPTH, 81);
  assert.ok(good.coveragePct >= 80);
  assert.equal(shouldSnapshot(good), true);

  // A CAPTCHA storm: only 40 of 81 points came back, all of them good.
  const storm = computeGridMetrics(Array<PointRank>(40).fill(1), DEPTH, 81);
  assert.equal(storm.score, 100, 'the points we did read looked perfect');
  assert.ok(storm.coveragePct < 80);
  assert.equal(
    shouldSnapshot(storm),
    false,
    'but 40 of 81 points knows too little to chart, in either direction',
  );

  assert.equal(shouldSnapshot(computeGridMetrics([], DEPTH, 81)), false);
});

test('visibility weighting is top-heavy, because local-pack clicks collapse after third', () => {
  assert.equal(visibilityWeight(1, DEPTH), 1);
  assert.equal(visibilityWeight(3, DEPTH), 0.7);
  assert.equal(visibilityWeight(4, DEPTH), 0.45);

  // The drop from 3rd to 4th must exceed the drop from 8th to 12th: falling out
  // of the pack is the event that costs a clinic phone calls.
  const packExit = visibilityWeight(3, DEPTH) - visibilityWeight(4, DEPTH);
  const deepShuffle = visibilityWeight(8, DEPTH) - visibilityWeight(12, DEPTH);
  assert.ok(packExit > deepShuffle, `${packExit} should exceed ${deepShuffle}`);

  assert.ok(visibilityWeight(20, DEPTH) >= 0, 'never negative at the depth limit');
});

test('two grids of different size stay comparable, since the metrics are means', () => {
  const small = computeGridMetrics(Array<PointRank>(49).fill(2), DEPTH, 49);
  const large = computeGridMetrics(Array<PointRank>(81).fill(2), DEPTH, 81);
  assert.equal(small.score, large.score);
  assert.equal(small.arp, large.arp);
});
