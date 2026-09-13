import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, gridFingerprint, innerSubset, zoomForSpacing } from '../src/grid.ts';

// Koramangala, Bengaluru — the reference clinic location for these tests.
const LAT = 12.9352;
const LNG = 77.6245;

test('builds an N x N grid centred on the clinic', () => {
  const grid = buildGrid(LAT, LNG, 9, 800);
  assert.equal(grid.length, 81);

  const centre = grid[40]; // row 4, col 4 of a 9x9
  assert.equal(centre?.row, 4);
  assert.equal(centre?.col, 4);
  assert.equal(centre?.lat, LAT, 'the centre cell sits exactly on the clinic');
  assert.equal(centre?.lng, LNG);
});

test('idx is row-major so it reads like the rendered heatmap', () => {
  const grid = buildGrid(LAT, LNG, 9, 800);
  grid.forEach((p, i) => {
    assert.equal(p.idx, i);
    assert.equal(p.idx, p.row * 9 + p.col);
  });

  // Row 0 is north (higher latitude), column 0 is west (lower longitude).
  assert.ok((grid[0]?.lat ?? 0) > LAT, 'first row is north of the centre');
  assert.ok((grid[0]?.lng ?? 0) < LNG, 'first column is west of the centre');
});

test('longitude spacing is cos(latitude)-corrected, not naive', () => {
  const grid = buildGrid(LAT, LNG, 3, 1000);
  const centre = grid[4]!;
  const east = grid[5]!;
  const north = grid[1]!;

  const latStepDeg = north.lat - centre.lat;
  const lngStepDeg = east.lng - centre.lng;

  // A degree of longitude is shorter than a degree of latitude away from the
  // equator, so covering the same 1000m east takes MORE degrees.
  assert.ok(lngStepDeg > latStepDeg, 'longitude step must exceed latitude step');

  // Tolerance accommodates the deliberate 6-decimal rounding of stored
  // coordinates (~11cm). It is still 260x tighter than the error a naive
  // implementation would produce, which would give a ratio of exactly 1.0.
  const expectedRatio = 1 / Math.cos((LAT * Math.PI) / 180);
  assert.ok(
    Math.abs(lngStepDeg / latStepDeg - expectedRatio) < 1e-4,
    `ratio should be 1/cos(lat) = ${expectedRatio}, got ${lngStepDeg / latStepDeg}`,
  );
});

test('the grid spans the distance it claims to', () => {
  const grid = buildGrid(LAT, LNG, 9, 800);
  const northWest = grid[0]!;
  const southWest = grid[72]!; // row 8, col 0

  // 9 points at 800m spacing = 8 intervals = 6.4km top to bottom.
  const spanM = (northWest.lat - southWest.lat) * 111_320;
  assert.ok(Math.abs(spanM - 6400) < 10, `expected ~6400m span, got ${Math.round(spanM)}m`);
});

test('rejects even or too-small grids rather than silently mis-centring', () => {
  assert.throws(() => buildGrid(LAT, LNG, 8, 800), /odd/);
  assert.throws(() => buildGrid(LAT, LNG, 2, 800), /at least 3/);
});

test('0.8km spacing in Bengaluru resolves to zoom 15', () => {
  assert.equal(zoomForSpacing(800, LAT), 15);
  // Tighter spacing needs a tighter viewport, wider needs a wider one.
  assert.ok(zoomForSpacing(400, LAT) > 15);
  assert.ok(zoomForSpacing(2000, LAT) < 15);
});

test('odd grids nest exactly, so a tighter view needs no rescan', () => {
  const outer = buildGrid(LAT, LNG, 9, 800);
  const inner = innerSubset(outer, 9, 7);
  const standalone = buildGrid(LAT, LNG, 7, 800);

  assert.equal(inner.length, 49);
  inner.forEach((p, i) => {
    assert.equal(p.lat, standalone[i]?.lat, `lat mismatch at ${i}`);
    assert.equal(p.lng, standalone[i]?.lng, `lng mismatch at ${i}`);
  });
});

test('fingerprint changes when the measurement changes, not when it does not', () => {
  const spec = { centreLat: LAT, centreLng: LNG, size: 9, spacingM: 800, zoom: 15, depth: 20 };
  const base = gridFingerprint(spec, 'dataforseo_maps', 'dental clinic');

  assert.equal(base, gridFingerprint(spec, 'dataforseo_maps', 'Dental Clinic'), 'keyword case is not a change');
  assert.equal(
    base,
    gridFingerprint({ ...spec, centreLat: LAT + 0.00001 }, 'dataforseo_maps', 'dental clinic'),
    'a ~1m re-pin of the centre is not a change',
  );

  assert.notEqual(base, gridFingerprint({ ...spec, size: 11 }, 'dataforseo_maps', 'dental clinic'));
  assert.notEqual(base, gridFingerprint({ ...spec, spacingM: 1000 }, 'dataforseo_maps', 'dental clinic'));
  assert.notEqual(base, gridFingerprint(spec, 'fixture_maps', 'dental clinic'));
  assert.notEqual(
    base,
    gridFingerprint({ ...spec, centreLat: LAT + 0.01 }, 'dataforseo_maps', 'dental clinic'),
    'a genuine relocation IS a change',
  );
});
