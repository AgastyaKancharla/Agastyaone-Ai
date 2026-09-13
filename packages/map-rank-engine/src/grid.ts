import type { GridPoint, GridSpec } from './types.ts';

/** Metres per degree of latitude. Constant enough at city scale. */
const M_PER_DEG_LAT = 111_320;

/** Mercator ground resolution at zoom 0, metres per pixel at the equator. */
const EQUATOR_M_PER_PX = 156_543.03392;

/**
 * The map canvas width Google renders at our configured viewport, in pixels.
 *
 * Pinned deliberately. The same `@zoom` at a different window size is a
 * different search area, so changing this silently changes what a scan means
 * and breaks comparability with every scan already recorded.
 */
export const CANVAS_WIDTH_PX = 958;

/** Results read per point. Changing this makes ATRP incomparable with all history. */
export const PINNED_DEPTH = 20;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Build an N×N grid of coordinates centred on the clinic.
 *
 * The longitude step divides by cos(latitude): a degree of longitude is only
 * ~108.5 km at Bengaluru's 12.97°N against ~111.3 km for latitude. Skipping
 * that correction squashes the grid east-west by about 2.5% — which sounds
 * small until the heatmap is used to argue that ranking falls off in one
 * direction and not the other.
 *
 * Row 0 is the northern edge and column 0 the western, so `idx` reads like the
 * rendered grid: left to right, top to bottom.
 */
export function buildGrid(centreLat: number, centreLng: number, size: number, spacingM: number): GridPoint[] {
  if (size < 3 || size % 2 === 0) {
    throw new Error(`Grid size must be odd and at least 3, got ${size}`);
  }

  const half = (size - 1) / 2;
  const latStep = spacingM / M_PER_DEG_LAT;
  const lngStep = spacingM / (M_PER_DEG_LAT * Math.cos(toRadians(centreLat)));

  const points: GridPoint[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      points.push({
        idx: row * size + col,
        row,
        col,
        lat: round6(centreLat + (half - row) * latStep),
        lng: round6(centreLng + (col - half) * lngStep),
      });
    }
  }
  return points;
}

/**
 * Zoom at which the map canvas half-width is roughly 2.5× the grid spacing.
 *
 * Too wide and neighbouring points return near-identical result sets, which
 * draws a falsely smooth heatmap; too tight and the viewport excludes
 * businesses that a real searcher at that point would see. 0.8 km spacing in
 * Bengaluru lands on z15.
 */
export function zoomForSpacing(spacingM: number, centreLat: number): number {
  const target = 2.5 * spacingM;
  const halfCanvasPx = CANVAS_WIDTH_PX / 2;
  const zoom = Math.log2((halfCanvasPx * EQUATOR_M_PER_PX * Math.cos(toRadians(centreLat))) / target);
  return Math.max(10, Math.min(18, Math.round(zoom)));
}

/**
 * Identity of the measurement itself, not of the business.
 *
 * A snapshot is only written under a matching fingerprint. Widening the grid or
 * changing the provider moves the number without anything about the clinic
 * changing, so the trend line has to break rather than pretend to continue.
 */
export function gridFingerprint(spec: GridSpec, providerCode: string, keyword: string): string {
  return [
    `s${spec.size}`,
    `d${spec.spacingM}`,
    `z${spec.zoom}`,
    `n${spec.depth}`,
    providerCode,
    keyword.trim().toLowerCase(),
    // Rounded to ~11 m so a trivial re-pin of the centre does not break history,
    // while a genuine relocation does.
    `${spec.centreLat.toFixed(4)},${spec.centreLng.toFixed(4)}`,
  ].join('|');
}

/**
 * The inner `size`×`size` subset of a larger grid.
 *
 * Odd grids at a fixed spacing nest exactly, so a 9×9 already contains a 7×7
 * scanned at the same points. That is the only way to show a tighter view, or
 * to shrink the default later, without rescanning or losing history.
 */
export function innerSubset(points: GridPoint[], outerSize: number, innerSize: number): GridPoint[] {
  if (innerSize > outerSize) throw new Error('Inner grid cannot be larger than the outer grid');
  if (innerSize % 2 === 0 || outerSize % 2 === 0) throw new Error('Both grid sizes must be odd');

  const margin = (outerSize - innerSize) / 2;
  return points.filter(
    (p) => p.row >= margin && p.row < outerSize - margin && p.col >= margin && p.col < outerSize - margin,
  );
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
