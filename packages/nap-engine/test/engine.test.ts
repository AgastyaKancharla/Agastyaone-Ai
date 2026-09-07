import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePhone, normalizeAddress, normalizeName } from '../src/normalize.ts';
import { selectMatch } from '../src/matcher.ts';
import { evaluateDirectory } from '../src/diff.ts';
import { summarize } from '../src/summarize.ts';
import type { Candidate, DirectoryResult, SourceOfTruth } from '../src/types.ts';

const clinic: SourceOfTruth = {
  businessName: 'Nissa Dental Clinic & Implant Center',
  addressLine1: 'No. 45, 100 Feet Road, 4th Block',
  locality: 'Koramangala',
  city: 'Bengaluru',
  pincode: '560034',
  phoneE164: '+918023456789',
  website: 'https://nissadental.com',
};

describe('normalisation', () => {
  test('the three Indian phone forms converge on one E.164 value', () => {
    for (const raw of ['+91 98765 43210', '09876543210', '9876543210', '0091 98765 43210']) {
      assert.equal(normalizePhone(raw), '+919876543210', `failed for ${raw}`);
    }
  });

  test('a Bengaluru landline keeps its STD code', () => {
    assert.equal(normalizePhone('080-2345 6789'), '+918023456789');
  });

  test('multi-word abbreviations resolve before single-word ones', () => {
    // The retired tool listed `rd -> road` first, making `main rd` unreachable.
    assert.match(normalizeAddress('12 Main Rd'), /main road/);
    assert.match(normalizeAddress('5th Cross Rd'), /cross road/);
  });

  test('"no" becomes "number" only when a number follows it', () => {
    assert.match(normalizeAddress('No. 45, 100 Feet Road'), /number 45/);
    // The retired tool rewrote every \bno\b and mangled addresses like this.
    assert.doesNotMatch(normalizeAddress('Nova No Frills Plaza'), /number frills/);
  });

  test('city aliases collapse', () => {
    assert.match(normalizeAddress('Koramangala, Bangalore'), /bengaluru/);
  });

  test('honorifics carry no identity signal', () => {
    assert.equal(normalizeName('Dr. Nissa Dental Pvt Ltd'), 'nissa dental');
  });
});

describe('identity verification', () => {
  test('an exact phone match identifies the business', () => {
    const out = selectMatch(clinic, [
      { listingUrl: 'https://x/1', name: 'Nissa Dental Clinic', address: 'No 45, 100 Feet Road, Koramangala', phone: '080 2345 6789' },
    ]);
    assert.equal(out.kind, 'matched');
  });

  test('two near-identical clinics are held as ambiguous, not guessed', () => {
    // This is the failure the retired tool shipped: it took the first hit and
    // reported a competitor's details as the client's own NAP error.
    // Two listings that look equally like the business — a duplicate listing, or
    // a same-named clinic in the same area. Neither is a better match, so
    // picking either is a coin flip.
    const twin:  Candidate = { listingUrl: 'https://x/3', name: 'Nissa Dental Clinic & Implant Center', address: '100 Feet Road, Koramangala, Bengaluru' };
    const twin2: Candidate = { listingUrl: 'https://x/4', name: 'Nissa Dental Clinic & Implant Center', address: '100 Feet Road, Koramangala, Bengaluru' };
    const out = selectMatch(clinic, [twin, twin2]);
    assert.equal(out.kind, 'ambiguous');
  });

  test('a listing that is clearly someone else is not_found, not diffed', () => {
    const out = selectMatch(clinic, [
      { listingUrl: 'https://x/9', name: 'Sunrise Physiotherapy', address: 'Indiranagar, Bengaluru', phone: '+919000000000' },
    ]);
    assert.equal(out.kind, 'not_found');
  });

  test('no candidates is not_found', () => {
    assert.equal(selectMatch(clinic, []).kind, 'not_found');
  });
});

describe('field diffs', () => {
  const matched: Candidate = {
    listingUrl: 'https://justdial.com/listing/1',
    name: 'Nissa Dental Clinic & Implant Center',
    address: 'No 45, 100 Feet Rd, 4th Block, Koramangala, Bengaluru 560034',
    phone: '080 2345 6789',
    website: 'nissadental.com',
  };

  test('an aligned listing is consistent', () => {
    const r = evaluateDirectory('justdial', clinic, [matched]);
    assert.equal(r.status, 'consistent');
    assert.equal(r.found, true);
    assert.equal(r.listingUrl, 'https://justdial.com/listing/1');
  });

  test('a MISSING phone is not the same as a WRONG phone', () => {
    // The retired tool collapsed these into one bucket, so "add your number"
    // and "someone published the wrong number" looked identical to the client.
    const absent = evaluateDirectory('justdial', clinic, [{ ...matched, phone: undefined }]);
    const wrong  = evaluateDirectory('justdial', clinic, [{ ...matched, phone: '+918011112222' }]);

    assert.equal(absent.diffs.find((d) => d.field === 'phone')?.status, 'missing');
    assert.equal(wrong.diffs.find((d) => d.field === 'phone')?.status, 'mismatch');

    // And they lead to different verdicts: absent is drift, wrong is inconsistent.
    assert.equal(absent.status, 'drift');
    assert.equal(wrong.status, 'inconsistent');
  });

  test('ambiguous results carry no field diffs at all', () => {
    const a: Candidate = { listingUrl: 'https://x/1', name: 'Nissa Dental Clinic & Implant Center', address: '100 Feet Road, Koramangala, Bengaluru' };
    const b: Candidate = { listingUrl: 'https://x/2', name: 'Nissa Dental Clinic & Implant Center', address: '100 Feet Road, Koramangala, Bengaluru' };
    const r = evaluateDirectory('practo', clinic, [a, b]);
    assert.equal(r.status, 'ambiguous');
    assert.deepEqual(r.diffs, []);
    assert.equal(r.overallConfidence, null);
  });

  test('the listing URL is never a search URL', () => {
    const r = evaluateDirectory('justdial', clinic, [matched]);
    assert.ok(!r.listingUrl?.includes('/search'));
  });
});

describe('summary', () => {
  const mk = (status: DirectoryResult['status'], overallConfidence: number | null = null): DirectoryResult => ({
    directoryCode: 'x', status, found: status !== 'not_found', listingUrl: null,
    matchConfidence: null, runnerUpMargin: null, overallConfidence,
    isClaimed: null, rating: null, reviewCount: null, diffs: [], errorMessage: null,
  });

  test('a blocked scraper does not lower the client score', () => {
    const clean = summarize([mk('consistent', 100), mk('consistent', 100)]);
    const blocked = summarize([mk('consistent', 100), mk('consistent', 100), mk('error')]);

    assert.equal(clean.auditScore, 100);
    // The retired tool averaged the error in as a zero and reported 67 here.
    assert.equal(blocked.auditScore, 100);
    assert.equal(blocked.coveragePct, 67);
    assert.equal(blocked.directoriesErrored, 1);
  });

  test('status counters partition the checked set exactly', () => {
    const s = summarize([
      mk('consistent', 100), mk('drift', 80), mk('inconsistent', 40),
      mk('not_found'), mk('ambiguous'), mk('error'),
    ]);
    const sum = s.consistentCount + s.driftCount + s.inconsistentCount + s.notFoundCount + s.ambiguousCount;
    // The retired tool double-counted drift into inconsistent and let errors
    // fall through every bucket, so this never held.
    assert.equal(sum, s.directoriesChecked);
    assert.equal(s.directoriesChecked, 5);
    assert.equal(s.directoriesRequested, 6);
  });

  test('no scorable listing yields a null score, not a zero', () => {
    // Zero would read as "your listings are terrible". Null reads as "we could
    // not assess them", which is the truth.
    const s = summarize([mk('not_found'), mk('ambiguous')]);
    assert.equal(s.auditScore, null);
  });
});
