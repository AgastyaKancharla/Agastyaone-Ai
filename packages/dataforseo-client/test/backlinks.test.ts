import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSummary } from '../src/backlinks.ts';

test('maps every field this product actually uses', () => {
  const summary = toSummary({
    rank: 340,
    backlinks: 512,
    referring_domains: 41,
    broken_backlinks: 3,
    backlinks_spam_score: 8,
  });
  assert.equal(summary.domainRank, 340);
  assert.equal(summary.totalBacklinks, 512);
  assert.equal(summary.referringDomains, 41);
  assert.equal(summary.brokenBacklinks, 3);
  assert.equal(summary.spamScore, 8);
});

test('a domain with no measured link profile is real zeros, not missing data', () => {
  const summary = toSummary({
    rank: 0,
    backlinks: 0,
    referring_domains: 0,
    broken_backlinks: 0,
    backlinks_spam_score: 0,
  });
  assert.equal(summary.referringDomains, 0);
  assert.equal(summary.totalBacklinks, 0);
});

test('missing count fields default to zero rather than becoming NaN downstream', () => {
  const summary = toSummary({});
  assert.equal(summary.referringDomains, 0);
  assert.equal(summary.totalBacklinks, 0);
  assert.equal(summary.brokenBacklinks, 0);
});

test('missing spam score and rank stay null, since a provider default of 0 would be a real claim', () => {
  const summary = toSummary({ referring_domains: 5 });
  assert.equal(summary.spamScore, null);
  assert.equal(summary.domainRank, null);
});
