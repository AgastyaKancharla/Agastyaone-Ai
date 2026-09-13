import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBacklinksScore } from '../src/scoring.ts';
import type { BacklinksSummary } from '../src/types.ts';

function summary(overrides: Partial<BacklinksSummary> = {}): BacklinksSummary {
  return {
    referringDomains: 10,
    totalBacklinks: 40,
    brokenBacklinks: 0,
    spamScore: 5,
    domainRank: 120,
    ...overrides,
  };
}

test('no completed check yet returns a null score, never zero', () => {
  const r = computeBacklinksScore(null);
  assert.equal(r.score, null, 'unmeasured, not zero');
  assert.equal(r.referringDomains, null);
});

test('zero referring domains from a completed check is a real, measured zero', () => {
  const r = computeBacklinksScore(summary({ referringDomains: 0, totalBacklinks: 0, spamScore: null }));
  assert.equal(r.score, 0);
  assert.equal(r.referringDomains, 0);
});

test('more referring domains scores higher, with diminishing returns', () => {
  const two = computeBacklinksScore(summary({ referringDomains: 2, spamScore: 0 }));
  const ten = computeBacklinksScore(summary({ referringDomains: 10, spamScore: 0 }));
  const fifty = computeBacklinksScore(summary({ referringDomains: 50, spamScore: 0 }));
  assert.ok(two.score! < ten.score!, 'more referring domains scores higher');
  assert.ok(ten.score! < fifty.score!);

  // Diminishing returns means the SAME size step (+1 domain) is worth more at
  // the low end than the high end -- not that any later, much bigger step is
  // worth less in total, which a log curve does not promise.
  const oneToTwo =
    computeBacklinksScore(summary({ referringDomains: 2, spamScore: 0 })).score! -
    computeBacklinksScore(summary({ referringDomains: 1, spamScore: 0 })).score!;
  const twentyFiveToTwentySix =
    computeBacklinksScore(summary({ referringDomains: 26, spamScore: 0 })).score! -
    computeBacklinksScore(summary({ referringDomains: 25, spamScore: 0 })).score!;
  assert.ok(
    oneToTwo > twentyFiveToTwentySix,
    'the same one-domain step is worth far more going from 1 to 2 than from 25 to 26',
  );
});

test('50 referring domains -- the local-practice target -- scores the full 100 before any spam penalty', () => {
  const r = computeBacklinksScore(summary({ referringDomains: 50, spamScore: 0 }));
  assert.equal(r.score, 100);
});

test('referring domains well past the target do not exceed 100', () => {
  const r = computeBacklinksScore(summary({ referringDomains: 5000, spamScore: 0 }));
  assert.equal(r.score, 100);
});

test('a spam score under the safe threshold carries no penalty', () => {
  const clean = computeBacklinksScore(summary({ referringDomains: 20, spamScore: 0 }));
  const stillClean = computeBacklinksScore(summary({ referringDomains: 20, spamScore: 30 }));
  assert.equal(clean.score, stillClean.score);
});

test('a visibly spammy link profile pulls the score down but never below zero', () => {
  const clean = computeBacklinksScore(summary({ referringDomains: 20, spamScore: 0 }));
  const spammy = computeBacklinksScore(summary({ referringDomains: 20, spamScore: 90 }));
  assert.ok(spammy.score! < clean.score!);
  assert.ok(spammy.score! >= 0);

  const zeroDomainsButSpammy = computeBacklinksScore(summary({ referringDomains: 0, spamScore: 90 }));
  assert.equal(zeroDomainsButSpammy.score, 0, 'the floor is zero, never negative');
});

test('a missing spam score (provider does not report one) is treated as no penalty', () => {
  const r = computeBacklinksScore(summary({ referringDomains: 20, spamScore: null }));
  const clean = computeBacklinksScore(summary({ referringDomains: 20, spamScore: 0 }));
  assert.equal(r.score, clean.score);
});

test('passes through the raw counts the Console and Portal display alongside the score', () => {
  const r = computeBacklinksScore(summary({ referringDomains: 7, totalBacklinks: 33, spamScore: 12 }));
  assert.equal(r.referringDomains, 7);
  assert.equal(r.totalBacklinks, 33);
  assert.equal(r.spamScore, 12);
});
