import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAiVisibilityScore } from '../src/scoring.ts';
import type { EngineRun } from '../src/types.ts';

const run = (wasMentioned: boolean, position: number | null = null): EngineRun => ({
  engine: 'chatgpt',
  wasMentioned,
  position,
});

test('no completed runs yet is null, not zero', () => {
  const r = computeAiVisibilityScore([]);
  assert.equal(r.score, null);
  assert.equal(r.mentionRate, null);
  assert.equal(r.runsConsidered, 0);
});

test('named first everywhere scores 100', () => {
  const r = computeAiVisibilityScore([run(true, 1), run(true, 1), run(true, 1)]);
  assert.equal(r.score, 100);
  assert.equal(r.mentionRate, 100);
});

test('never mentioned anywhere is a genuine zero', () => {
  const r = computeAiVisibilityScore([run(false), run(false)]);
  assert.equal(r.score, 0);
  assert.equal(r.mentionRate, 0);
});

test('position is top-heavy: first vastly outweighs fourth', () => {
  const first = computeAiVisibilityScore([run(true, 1)]);
  const fourth = computeAiVisibilityScore([run(true, 4)]);
  assert.ok((first.score ?? 0) > (fourth.score ?? 0) * 2, 'first place must be worth well over double fourth');
});

test('a prose mention with no position scores as real credit, less than first place', () => {
  const prose = computeAiVisibilityScore([run(true, null)]);
  const first = computeAiVisibilityScore([run(true, 1)]);
  assert.ok((prose.score ?? 0) > 0);
  assert.ok((prose.score ?? 0) < (first.score ?? 0));
});

test('mixed engines average, and mentionRate is a plain frequency independent of position', () => {
  const r = computeAiVisibilityScore([run(true, 1), run(false), run(true, 3), run(false)]);
  assert.equal(r.mentionRate, 50, '2 of 4 runs mentioned the clinic at all');
  assert.equal(r.runsConsidered, 4);
  assert.ok(r.score !== null && r.score > 0 && r.score < 100);
});
