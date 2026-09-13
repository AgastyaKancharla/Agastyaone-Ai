import type {
  MapRankProvider,
  MapsListing,
  PointOutcome,
  PointRequest,
} from '@agastyaone/map-rank-engine';

/**
 * A deterministic stand-in for the real Maps provider.
 *
 * Selected automatically whenever DataForSEO credentials are absent, which
 * means the whole grid pipeline — queue, worker, scoring, heatmap — is
 * buildable, testable and demonstrable before anyone has paid for anything, and
 * CI never makes a paid network call.
 *
 * It models the one thing that actually matters about local ranking: results
 * degrade with distance from the business. A clinic ranks well on its own
 * doorstep and falls away outward, which is the shape a real heatmap has and
 * the reason the grid is worth scanning at all. Randomness is hashed from the
 * coordinates, so the same grid always produces the same picture and a test can
 * assert on it.
 *
 * Competitor names are deliberately and obviously synthetic. Inventing results
 * that name real clinics would put fabricated ranking claims about real
 * businesses into a client-facing product.
 */

const DEMO_COMPETITORS = [
  'Demo Dental A',
  'Demo Dental B',
  'Demo Dental C',
  'Demo Dental D',
  'Demo Dental E',
  'Demo Dental F',
  'Demo Dental G',
  'Demo Dental H',
];

export interface FixtureOptions {
  /** The clinic being scanned, so it can appear in its own results. */
  placeId: string | null;
  name: string;
  centreLat: number;
  centreLng: number;
  /** Metres beyond which the clinic stops appearing at all. */
  visibleRadiusM?: number;
}

/** FNV-1a. Small, dependency-free, and stable across runs and machines. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const latM = (aLat - bLat) * 111_320;
  const lngM = (aLng - bLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(latM, lngM);
}

export function createFixtureProvider(options: FixtureOptions): MapRankProvider {
  const visibleRadiusM = options.visibleRadiusM ?? 2600;

  return {
    code: 'fixture_maps',
    maxDepth: 20,
    costMicrosPerPoint: 0,

    async collect(req: PointRequest): Promise<PointOutcome> {
      const seed = hash(`${req.keyword}|${req.point.lat.toFixed(5)}|${req.point.lng.toFixed(5)}`);
      const distance = metresBetween(
        req.point.lat,
        req.point.lng,
        options.centreLat,
        options.centreLng,
      );

      // One point in every ~40 comes back blocked, so the coverage rule and the
      // 'partial' status are exercised by the demo rather than only by tests.
      if (seed % 40 === 0) {
        return { status: 'blocked', reason: 'Fixture: simulated rate limit' };
      }

      const listings: MapsListing[] = [];
      const jitter = (seed % 5) - 2;
      // Rank 1 at the centre, degrading roughly one position per 400m out.
      const ourRank = Math.max(1, Math.round(distance / 400) + 1 + jitter);
      const appears = distance <= visibleRadiusM && ourRank <= req.depth;

      for (let position = 1; position <= req.depth; position++) {
        if (appears && position === ourRank) {
          listings.push({
            position,
            placeId: options.placeId ?? 'fixture-self',
            name: options.name,
            rating: 4.6,
            reviewCount: 128,
          });
          continue;
        }
        const which = (seed + position) % DEMO_COMPETITORS.length;
        listings.push({
          position,
          placeId: `fixture-competitor-${which}`,
          name: DEMO_COMPETITORS[which] ?? 'Demo Dental',
          rating: 3.8 + ((seed + position) % 12) / 10,
          reviewCount: 20 + ((seed + position * 7) % 400),
        });
      }

      return { status: 'ok', listings, fetchedAt: new Date().toISOString() };
    },
  };
}
