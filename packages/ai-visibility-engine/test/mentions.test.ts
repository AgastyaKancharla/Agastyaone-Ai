import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseAnswer } from '../src/mentions.ts';

const CLIENT = 'Smile Dental Clinic';

const LIST_ANSWER = `Here are some well-regarded dental clinics in Koramangala, Bengaluru:

1. Bright Smiles Dental — known for cosmetic dentistry.
2. Smile Dental Clinic, a highly-rated practice offering root canals and implants.
3. City Dental Care, a large multi-specialty chain.
4. Koramangala Orthodontics, focused on braces and aligners.

All of these are within a short distance of Koramangala 5th Block.`;

test('finds the client inside a numbered list and reports its position', () => {
  const r = analyseAnswer(LIST_ANSWER, CLIENT);
  assert.equal(r.wasMentioned, true);
  assert.equal(r.position, 2);
  assert.equal(r.shareOfVoice, 25, '1 of 4 named businesses');
});

test('a competing clinic is recorded as a real, unmentioned zero, not an absence', () => {
  const withoutClient = LIST_ANSWER.replace('2. Smile Dental Clinic, a highly-rated practice offering root canals and implants.\n', '');
  const r = analyseAnswer(withoutClient, CLIENT);
  assert.equal(r.wasMentioned, false);
  assert.equal(r.shareOfVoice, 0, 'others were named, the client was not -- a real zero');
});

test('an answer naming no business at all measures nothing', () => {
  const r = analyseAnswer('I don\'t have enough information to recommend a specific clinic.', CLIENT);
  assert.equal(r.wasMentioned, false);
  assert.equal(r.shareOfVoice, null, 'nothing was named, so nothing can be measured about the client');
  assert.equal(r.mentions.length, 0);
});

test('prose mention with no list structure still counts, with no position', () => {
  const r = analyseAnswer(
    'For root canals in that area, Smile Dental Clinic has a strong reputation among patients.',
    CLIENT,
  );
  assert.equal(r.wasMentioned, true);
  assert.equal(r.position, null);
  assert.equal(r.shareOfVoice, 100, 'the only business named at all');
});

test('name matching tolerates paraphrase, not just exact quotes', () => {
  assert.equal(analyseAnswer('1. Smile Dental — great reviews', CLIENT).wasMentioned, true);
  assert.equal(analyseAnswer('1. Smile Dental Clinic Koramangala Branch', CLIENT).wasMentioned, true);
  assert.equal(
    analyseAnswer('1. Totally Unrelated Dental Practice', CLIENT).wasMentioned,
    false,
    'must not match on the word "Dental" alone',
  );
});

test('sentiment is read from words near the mention, not the whole answer', () => {
  const positive = analyseAnswer('1. Smile Dental Clinic is highly-rated and excellent for implants.', CLIENT);
  assert.equal(positive.mentions[0]?.sentiment, 'positive');

  const negative = analyseAnswer('1. Smile Dental Clinic has had complaints about wait times.', CLIENT);
  assert.equal(negative.mentions[0]?.sentiment, 'negative');

  const neutral = analyseAnswer('1. Smile Dental Clinic offers general dentistry.', CLIENT);
  assert.equal(neutral.mentions[0]?.sentiment, null);
});

test('citation markers resolve against the provided URL list', () => {
  const r = analyseAnswer(
    '1. Smile Dental Clinic [1] is a popular choice in the area.',
    CLIENT,
    ['https://smiledental.example'],
  );
  assert.equal(r.mentions[0]?.citedUrl, 'https://smiledental.example');
});

test('a mention with no matching citation marker gets no URL, not a guess', () => {
  const r = analyseAnswer('1. Smile Dental Clinic is a popular choice.', CLIENT, ['https://smiledental.example']);
  assert.equal(r.mentions[0]?.citedUrl, null);
});

test('duplicate list entries for the same business are not double counted', () => {
  const r = analyseAnswer(
    '1. Smile Dental Clinic\n2. Bright Smiles\n3. Smile Dental Clinic again',
    CLIENT,
  );
  assert.equal(r.mentions.filter((m) => m.isClient).length, 1);
});

test('empty and malformed input is a non-mention, never a crash', () => {
  for (const input of ['', '   ', '1.', '- ', '###???']) {
    const r = analyseAnswer(input, CLIENT);
    assert.equal(r.wasMentioned, false);
    assert.ok(Array.isArray(r.mentions));
  }
});
