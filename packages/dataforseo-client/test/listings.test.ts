import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toListings } from '../src/client.ts';

test('strips paid placements and renumbers from 1', () => {
  const listings = toListings([
    { type: 'maps_search_ad', rank_absolute: 1, title: 'Sponsored Clinic' },
    { type: 'maps_search', rank_absolute: 2, title: 'Real Clinic A', place_id: 'a' },
    { type: 'maps_search', rank_absolute: 3, title: 'Real Clinic B', place_id: 'b' },
  ]);

  assert.equal(listings.length, 2, 'the ad is not a ranking');
  // The clinic is organically FIRST. Trusting rank_absolute would have recorded
  // it as second — and the number would then move whenever a rival started or
  // stopped buying ads, which is not a change in this clinic's ranking and must
  // never appear on their chart as one.
  assert.equal(listings[0]?.position, 1);
  assert.equal(listings[0]?.placeId, 'a');
  assert.equal(listings[1]?.position, 2);
});

test('a rival buying ads does not move anyone organic', () => {
  const organic = [
    { type: 'maps_search', title: 'Clinic A', place_id: 'a' },
    { type: 'maps_search', title: 'Clinic B', place_id: 'b' },
  ];

  const without = toListings(organic);
  const withAds = toListings([
    { type: 'maps_search_ad', title: 'Ad 1' },
    ...organic,
    { type: 'maps_search_ad', title: 'Ad 2' },
  ]);

  assert.deepEqual(without, withAds);
});

test('falls back to cid when place_id is absent, since identity is the whole match', () => {
  const [listing] = toListings([{ type: 'maps_search', title: 'Clinic', cid: '12345' }]);
  assert.equal(listing?.placeId, '12345');
});

test('maps rating and review count out of their nested shape', () => {
  const [listing] = toListings([
    { type: 'maps_search', title: 'Clinic', rating: { value: 4.7, votes_count: 312 } },
  ]);
  assert.equal(listing?.rating, 4.7);
  assert.equal(listing?.reviewCount, 312);
});

test('missing fields become undefined rather than empty strings', () => {
  const [listing] = toListings([{ type: 'maps_search' }]);
  assert.equal(listing?.position, 1);
  assert.equal(listing?.name, undefined);
  assert.equal(listing?.rating, undefined);
  assert.equal(listing?.placeId, undefined);
});

test('an empty or all-ads result set is empty, not a phantom ranking', () => {
  assert.deepEqual(toListings([]), []);
  assert.deepEqual(toListings([{ type: 'maps_search_ad', title: 'Ad' }]), []);
});
