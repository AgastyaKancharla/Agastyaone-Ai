/** Which search surface a signal serves. */
export type SignalGroup = 'seo' | 'geo' | 'aeo';

/**
 * 'issue' is wrong or missing-and-required; 'opportunity' is a real gain that
 * is not a fault; 'passed' is kept so the client sees a whole checklist rather
 * than only a list of faults -- the same reason nap_compliance_findings keeps
 * disclosure_present.
 */
export type FindingKind = 'issue' | 'opportunity' | 'passed';

export type Severity = 'high' | 'medium' | 'low';

export interface WebsiteFinding {
  kind: FindingKind;
  signalGroup: SignalGroup;
  ruleLabel: string;
  severity: Severity | null;
  snippet: string | null;
  remediation: string | null;
}

export interface WebsiteAnalysis {
  /** Per-group sub-scores, 0-100. */
  seo: number;
  geo: number;
  aeo: number;
  /** The website pillar score handed to the composite. */
  score: number;
  findings: WebsiteFinding[];
}

/**
 * The slice of a PageSpeed Insights response this engine uses.
 *
 * Kept as a plain summary rather than the raw Lighthouse payload so the engine
 * stays pure and the worker owns the fetching and shape-mapping -- the same
 * split as `Candidate` in nap-engine, where adapters do the I/O and the engine
 * only ever sees already-fetched data.
 */
export interface PageSpeedSummary {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  /** Largest Contentful Paint, milliseconds. */
  lcpMs: number | null;
  /** Cumulative Layout Shift, unitless. */
  cls: number | null;
}

export const PILLARS = [
  'map_rank',
  'website',
  'citations',
  'reviews',
  'ai_visibility',
  'backlinks',
] as const;

export type Pillar = (typeof PILLARS)[number];

/**
 * What each pillar is worth in the composite, out of 100.
 *
 * Map rank leads because for a clinic, position on the map is the single
 * strongest predictor of a phone call. Backlinks trail because for a
 * single-location practice they move slowly and are the hardest to influence
 * -- worth measuring, not worth pricing a retainer on.
 *
 * These will be re-tuned once there is real data. Every run records the weight
 * it used (visibility_pillar_scores.weight), so re-tuning never rewrites what
 * an old audit meant.
 */
export const PILLAR_WEIGHTS: Record<Pillar, number> = {
  map_rank: 25,
  website: 20,
  citations: 20,
  reviews: 15,
  ai_visibility: 15,
  backlinks: 5,
};

/**
 * Declared here rather than imported, because this package carries no
 * dependencies -- but shaped to be structurally assignable to the `Json` type
 * the generated Supabase types use, so `detail` crosses into a jsonb column
 * without a cast.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export type JsonObject = { [key: string]: JsonValue | undefined };

export interface PillarInput {
  pillar: Pillar;
  /** Null means "could not be measured", which is never the same as zero. */
  score: number | null;
  detail?: JsonObject | undefined;
}

export interface ScoredPillar {
  pillar: Pillar;
  score: number | null;
  weight: number;
  measured: boolean;
  detail: JsonObject | null;
}

export interface CompositeResult {
  /** Null when nothing at all could be measured. */
  score: number | null;
  /** Share of the model's total weight that was actually measured. */
  coveragePct: number;
  pillars: ScoredPillar[];
}
