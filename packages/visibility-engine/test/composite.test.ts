import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compositeScore } from '../src/composite.ts';

test('scores over measured pillars only, re-normalising their weights', () => {
  // website 20 + citations 20 + reviews 15 = 55 of 100 total weight.
  const result = compositeScore([
    { pillar: 'website', score: 80 },
    { pillar: 'citations', score: 60 },
    { pillar: 'reviews', score: 40 },
  ]);

  // (80*20 + 60*20 + 40*15) / 55 = 3400/55
  assert.equal(result.score, 61.82);
  assert.equal(result.coveragePct, 55);
});

test('an unmeasured pillar does not drag the score down', () => {
  const withOnlyWebsite = compositeScore([{ pillar: 'website', score: 80 }]);
  assert.equal(withOnlyWebsite.score, 80, 'a single measured pillar scores exactly itself');
  assert.equal(withOnlyWebsite.coveragePct, 20);

  // The same client once map rank is added and scores identically: the score
  // must not move, because nothing about the business changed.
  const withMapRank = compositeScore([
    { pillar: 'website', score: 80 },
    { pillar: 'map_rank', score: 80 },
  ]);
  assert.equal(withMapRank.score, 80);
  assert.equal(withMapRank.coveragePct, 45);
});

test('zero is preserved as a real measurement, distinct from unmeasured', () => {
  const measuredZero = compositeScore([
    { pillar: 'website', score: 100 },
    { pillar: 'citations', score: 0 },
  ]);
  // (100*20 + 0*20) / 40 = 50 -- the zero counts.
  assert.equal(measuredZero.score, 50);
  assert.equal(measuredZero.coveragePct, 40);

  const unmeasured = compositeScore([
    { pillar: 'website', score: 100 },
    { pillar: 'citations', score: null },
  ]);
  assert.equal(unmeasured.score, 100, 'null is excluded, not counted as zero');
  assert.equal(unmeasured.coveragePct, 20);
});

test('nothing measurable returns a null score, never zero', () => {
  const result = compositeScore([
    { pillar: 'website', score: null },
    { pillar: 'citations', score: null },
  ]);
  assert.equal(result.score, null);
  assert.equal(result.coveragePct, 0);
});

test('always reports all six pillars so the client sees what was not measured', () => {
  const result = compositeScore([{ pillar: 'website', score: 70 }]);
  assert.equal(result.pillars.length, 6);
  assert.equal(result.pillars.filter((p) => p.measured).length, 1);
  const backlinks = result.pillars.find((p) => p.pillar === 'backlinks');
  assert.equal(backlinks?.measured, false);
  assert.equal(backlinks?.score, null);
  assert.equal(backlinks?.weight, 5, 'weight is recorded even when unmeasured');
});
